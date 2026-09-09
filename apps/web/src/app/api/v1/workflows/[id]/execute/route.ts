import { prisma } from "@zynvex/database";
import { requestContext } from "@/lib/request";
import { requireSessionContext } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { workflowExecutionSchema } from "@/lib/input";
import { enqueueWorkflowExecution } from "@/lib/execution";
import { ApiError, toErrorResponse } from "@/lib/errors";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = requestContext(request);
  try {
    const session = await requireSessionContext();
    requirePermission(session.role, "workflows.execute");

    const { id } = await context.params;
    const body = workflowExecutionSchema.parse(await request.json());
    const workflow = await prisma.workflow.findFirst({ where: { id, organizationId: session.organizationId } });
    if (!workflow) throw new ApiError("NOT_FOUND", 404, "Workflow not found");

    const execution = await enqueueWorkflowExecution({
      organizationId: session.organizationId,
      userId: session.userId,
      workflowId: workflow.id,
      projectId: workflow.projectId,
      input: body.input,
      priority: body.priority,
      budget: body.budget,
      timeoutSeconds: body.timeoutSeconds,
      idempotencyKey: body.idempotencyKey
    });

    return Response.json({ execution }, { status: 202 });
  } catch (error) {
    return toErrorResponse(error, ctx.requestId);
  }
}
