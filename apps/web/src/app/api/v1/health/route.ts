import { prisma } from "@zynvex/database";
import { requestContext } from "@/lib/request";

export async function GET(request: Request) {
  const ctx = requestContext(request);
  const startedAt = Date.now();

  let database = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "error";
  }

  return Response.json({
    status: database === "ok" ? "ok" : "degraded",
    requestId: ctx.requestId,
    checks: {
      database,
      redis: process.env.REDIS_URL ? "configured" : "not_configured",
      aiProviders: {
        openai: Boolean(process.env.OPENAI_API_KEY),
        anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
        gemini: Boolean(process.env.GEMINI_API_KEY),
        deepseek: Boolean(process.env.DEEPSEEK_API_KEY),
        ollama: Boolean(process.env.OLLAMA_BASE_URL)
      }
    },
    latencyMs: Date.now() - startedAt
  });
}
