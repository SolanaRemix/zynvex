export type AiProvider = "openai" | "anthropic" | "gemini" | "deepseek" | "ollama";
export type ProviderHealthStatus = "HEALTHY" | "DEGRADED" | "OFFLINE" | "NOT_CONFIGURED";

export interface ModelRouteRequest {
  prompt: string;
  model: string;
  provider?: AiProvider;
  temperature?: number;
  maxTokens?: number;
  fallbackProviders?: AiProvider[];
}

export interface ModelRouteResult {
  provider: AiProvider;
  model: string;
  output: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  latencyMs: number;
  attempts: Array<{ provider: AiProvider; success: boolean; error?: string }>;
}

export interface ProviderHealthResult {
  provider: AiProvider;
  status: ProviderHealthStatus;
  latencyMs?: number;
  error?: string;
}

const PROVIDER_ENV_KEY: Record<Exclude<AiProvider, "ollama">, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  gemini: "GEMINI_API_KEY",
  deepseek: "DEEPSEEK_API_KEY"
};

type FetchResult = {
  provider: AiProvider;
  model: string;
  output: string;
};

function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

async function parseJson(response: Response) {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `Provider request failed with ${response.status}`);
  }

  return text ? JSON.parse(text) : {};
}

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

  async health(provider: AiProvider): Promise<ProviderHealthResult> {
    const start = Date.now();
    try {
      this.ensureConfigured(provider);
      if (provider === "ollama") {
        const response = await fetch(new URL("/api/tags", this.env.OLLAMA_BASE_URL).toString(), { method: "GET" });
        if (!response.ok) throw new Error(`Ollama health check failed with ${response.status}`);
      }

      return { provider, status: "HEALTHY", latencyMs: Date.now() - start };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown provider error";
      return {
        provider,
        status: message.includes("not configured") ? "NOT_CONFIGURED" : "OFFLINE",
        latencyMs: Date.now() - start,
        error: message
      };
    }
  }

  private async runOpenAiCompatible(provider: AiProvider, baseUrl: string, apiKey: string, request: ModelRouteRequest): Promise<FetchResult> {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey
      },
      body: JSON.stringify({
        model: request.model,
        temperature: request.temperature ?? 0.2,
        max_tokens: request.maxTokens,
        messages: [{ role: "user", content: request.prompt }]
      })
    });

    const data = await parseJson(response);
    const output = data.choices?.[0]?.message?.content;
    if (!output || typeof output !== "string") {
      throw new Error(`${provider} returned an empty response`);
    }

    return {
      provider,
      model: data.model || request.model,
      output
    };
  }

  private async runAnthropic(request: ModelRouteRequest): Promise<FetchResult> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: request.maxTokens ?? 1024,
        temperature: request.temperature ?? 0.2,
        messages: [{ role: "user", content: request.prompt }]
      })
    });

    const data = await parseJson(response);
    const output = data.content?.map((item: { type: string; text?: string }) => item.type === "text" ? item.text ?? "" : "").join("").trim();
    if (!output) throw new Error("anthropic returned an empty response");
    return { provider: "anthropic", model: data.model || request.model, output };
  }

  private async runGemini(request: ModelRouteRequest): Promise<FetchResult> {
    const apiKey = this.env.GEMINI_API_KEY;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${request.model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: {
          temperature: request.temperature ?? 0.2,
          maxOutputTokens: request.maxTokens ?? 1024
        },
        contents: [{ role: "user", parts: [{ text: request.prompt }] }]
      })
    });

    const data = await parseJson(response);
    const output = data.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("").trim();
    if (!output) throw new Error("gemini returned an empty response");
    return { provider: "gemini", model: request.model, output };
  }

  private async runProvider(provider: AiProvider, request: ModelRouteRequest): Promise<FetchResult> {
    this.ensureConfigured(provider);

    switch (provider) {
      case "openai":
        return this.runOpenAiCompatible(provider, "https://api.openai.com/v1", this.env.OPENAI_API_KEY ?? "", request);
      case "deepseek":
        return this.runOpenAiCompatible(provider, "https://api.deepseek.com", this.env.DEEPSEEK_API_KEY ?? "", request);
      case "anthropic":
        return this.runAnthropic(request);
      case "gemini":
        return this.runGemini(request);
      case "ollama": {
        const response = await fetch(new URL("/api/generate", this.env.OLLAMA_BASE_URL).toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: request.model,
            prompt: request.prompt,
            options: {
              temperature: request.temperature ?? 0.2,
              num_predict: request.maxTokens ?? 1024
            },
            stream: false
          })
        });

        const data = await parseJson(response);
        const output = typeof data.response === "string" ? data.response.trim() : "";
        if (!output) throw new Error("ollama returned an empty response");
        return { provider: "ollama", model: request.model, output };
      }
    }
  }

  async run(request: ModelRouteRequest): Promise<ModelRouteResult> {
    const start = Date.now();
    const primaryProvider = this.resolveProvider(request);
    const providers = [primaryProvider, ...(request.fallbackProviders ?? []).filter((provider) => provider !== primaryProvider)];
    const attempts: Array<{ provider: AiProvider; success: boolean; error?: string }> = [];
    let lastError: unknown;

    for (const provider of providers) {
      try {
        const result = await this.runProvider(provider, request);
        const latencyMs = Date.now() - start;
        attempts.push({ provider, success: true });
        return {
          provider: result.provider,
          model: result.model,
          output: result.output,
          inputTokens: estimateTokens(request.prompt),
          outputTokens: estimateTokens(result.output),
          estimatedCost: 0,
          latencyMs,
          attempts
        };
      } catch (error) {
        lastError = error;
        attempts.push({ provider, success: false, error: error instanceof Error ? error.message : "Unknown provider error" });
      }
    }

    throw new Error(lastError instanceof Error ? lastError.message : "All providers failed");
  }
}
