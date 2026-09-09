import { requestContext } from "@/lib/request";
import { requireSessionContext } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { approvalDecisionSchema } from "@/lib/input";
import { resolveApprovalRequest } from "@/lib/execution";
import { toErrorResponse } from "@/lib/errors";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = requestContext(request);
  try {
    const session = await requireSessionContext();
    requirePermission(session.role, "agents.manage");
    const body = approvalDecisionSchema.parse(await request.json());
    const { id } = await context.params;

    const approval = await resolveApprovalRequest({
      organizationId: session.organizationId,
      approvalRequestId: id,
      approverId: session.userId,
      decision: body.decision,
      comment: body.comment
    });

    return Response.json({ approval });
  } catch (error) {
    return toErrorResponse(error, ctx.requestId);
  }
}
