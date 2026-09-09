import { prisma } from "@zynvex/database";
import { requestContext } from "@/lib/request";
import { requireSessionContext } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { ApiError, toErrorResponse } from "@/lib/errors";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = requestContext(request);
  try {
    const session = await requireSessionContext();
    requirePermission(session.role, "api_keys.manage");
    const { id } = await context.params;

    const key = await prisma.apiKey.findFirst({ where: { id, organizationId: session.organizationId } });
    if (!key) throw new ApiError("NOT_FOUND", 404, "API key not found");

    await prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
    return Response.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error, ctx.requestId);
  }
}
