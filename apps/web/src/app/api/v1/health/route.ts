import { prisma } from "@zynvex/database";
import { ModelRouter } from "@zynvex/ai";
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

  const queue = await prisma.queueJob.groupBy({
    by: ["status"],
    _count: { _all: true }
  }).catch(() => []);

  const router = new ModelRouter(process.env);
  const providers = await Promise.all(["openai", "anthropic", "gemini", "deepseek", "ollama"].map((provider) => router.health(provider as never)));

  return Response.json({
    status: database === "ok" ? "ok" : "degraded",
    requestId: ctx.requestId,
    checks: {
      database,
      redis: process.env.REDIS_URL ? "configured" : "not_configured",
      aiProviders: providers,
      queue
    },
    latencyMs: Date.now() - startedAt
  });
}
