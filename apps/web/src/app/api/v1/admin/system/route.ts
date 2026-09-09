import { prisma } from "@zynvex/database";
import { ModelRouter } from "@zynvex/ai";
import { requestContext } from "@/lib/request";
import { requireSessionContext } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { toErrorResponse } from "@/lib/errors";

export async function GET(request: Request) {
  const ctx = requestContext(request);
  try {
    const session = await requireSessionContext();
    requirePermission(session.role, "audit.read");

    const router = new ModelRouter(process.env);
    const [queue, recentProviderChecks] = await Promise.all([
      prisma.queueJob.groupBy({
        by: ["status"],
        where: { organizationId: session.organizationId },
        _count: { _all: true }
      }),
      prisma.providerHealthCheck.findMany({
        where: { OR: [{ organizationId: session.organizationId }, { organizationId: null }] },
        orderBy: { checkedAt: "desc" },
        take: 20
      })
    ]);

    const providers = await Promise.all(["openai", "anthropic", "gemini", "deepseek", "ollama"].map((provider) => router.health(provider as never)));
    await prisma.providerHealthCheck.createMany({
      data: providers.map((provider) => ({
        organizationId: session.organizationId,
        provider: provider.provider,
        status: provider.status,
        latencyMs: provider.latencyMs,
        metadata: provider.error ? { error: provider.error } : undefined
      }))
    });

    return Response.json({
      queue,
      providers,
      recentProviderChecks
    });
  } catch (error) {
    return toErrorResponse(error, ctx.requestId);
  }
}
