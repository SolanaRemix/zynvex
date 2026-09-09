import { z } from "zod";

export const appEnvSchema = z.object({
  APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  OLLAMA_BASE_URL: z.string().url().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  SOLANA_RPC_URL: z.string().optional(),
  ZVX_MINT_ADDRESS: z.string().optional(),
  JUPITER_API_URL: z.string().optional()
});

export type AppEnv = z.infer<typeof appEnvSchema>;

export function getConfigState(env: NodeJS.ProcessEnv) {
  const parsed = appEnvSchema.safeParse(env);
  if (!parsed.success) {
    return { configured: false, errors: parsed.error.issues.map((i) => i.message) };
  }

  const productionRequired = [
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GEMINI_API_KEY",
    "DEEPSEEK_API_KEY"
  ] as const;

  const missing = parsed.data.APP_ENV === "production"
    ? productionRequired.filter((key) => !parsed.data[key])
    : [];

  return { configured: missing.length === 0, errors: missing.map((m) => `${m} is required in production`) };
}
