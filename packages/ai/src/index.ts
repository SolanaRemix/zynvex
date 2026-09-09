export type AiProvider = "openai" | "anthropic" | "gemini" | "deepseek" | "ollama";

export interface ModelRouteRequest {
  prompt: string;
  model: string;
  provider?: AiProvider;
  temperature?: number;
}

export interface ModelRouteResult {
  provider: AiProvider;
  model: string;
  output: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  latencyMs: number;
}

const PROVIDER_ENV_KEY: Record<Exclude<AiProvider, "ollama">, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  gemini: "GEMINI_API_KEY",
  deepseek: "DEEPSEEK_API_KEY"
};

export class ModelRouter {
  constructor(private readonly env: NodeJS.ProcessEnv) {}

  resolveProvider(request: ModelRouteRequest): AiProvider {
    if (request.provider) return request.provider;

    if (request.model.includes("gpt")) return "openai";
    if (request.model.includes("claude")) return "anthropic";
    if (request.model.includes("gemini")) return "gemini";
    if (request.model.includes("deepseek")) return "deepseek";
    return "ollama";
  }

  ensureConfigured(provider: AiProvider) {
    if (provider === "ollama") {
      if (!this.env.OLLAMA_BASE_URL) throw new Error("Ollama provider not configured");
      return;
    }

    const key = PROVIDER_ENV_KEY[provider];
    if (!this.env[key]) throw new Error(`${provider} provider not configured`);
  }

  async run(request: ModelRouteRequest): Promise<ModelRouteResult> {
    const start = Date.now();
    const provider = this.resolveProvider(request);
    this.ensureConfigured(provider);

    const output = `Provider ${provider} is configured. Connect ${provider} implementation via packages/ai adapters for live output.`;

    return {
      provider,
      model: request.model,
      output,
      inputTokens: Math.ceil(request.prompt.length / 4),
      outputTokens: Math.ceil(output.length / 4),
      estimatedCost: 0,
      latencyMs: Date.now() - start
    };
  }
}
