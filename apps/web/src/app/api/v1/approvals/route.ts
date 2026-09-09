import { prisma } from "@zynvex/database";
import { requestContext } from "@/lib/request";
import { requireSessionContext } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { toErrorResponse } from "@/lib/errors";

export async function GET(request: Request) {
  const ctx = requestContext(request);
  try {
    const session = await requireSessionContext();
    requirePermission(session.role, "agents.manage");

    const approvals = await prisma.approvalRequest.findMany({
      where: { organizationId: session.organizationId },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 100
    });

    return Response.json({ approvals });
  } catch (error) {
    return toErrorResponse(error, ctx.requestId);
  }
}
