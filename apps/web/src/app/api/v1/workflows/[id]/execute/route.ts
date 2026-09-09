import { prisma } from "@zynvex/database";
import { requestContext } from "@/lib/request";
import { requireSessionContext } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { ApiError, toErrorResponse } from "@/lib/errors";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = requestContext(request);
  try {
    const session = await requireSessionContext();
    requirePermission(session.role, "workflows.execute");

    const { id } = await context.params;
    const workflow = await prisma.workflow.findFirst({ where: { id, organizationId: session.organizationId } });
    if (!workflow) throw new ApiError("NOT_FOUND", 404, "Workflow not found");

    const execution = await prisma.workflowExecution.create({
      data: {
        organizationId: session.organizationId,
        workflowId: workflow.id,
        startedById: session.userId,
        status: "COMPLETED",
        completedAt: new Date()
      }
    });

    await prisma.task.create({
      data: {
        organizationId: session.organizationId,
        projectId: workflow.projectId,
        sourceType: "WORKFLOW",
        sourceId: execution.id,
        status: "COMPLETED",
        startedAt: execution.startedAt,
        completedAt: execution.completedAt,
        durationMs: execution.completedAt ? execution.completedAt.getTime() - execution.startedAt.getTime() : 0,
        cost: 0
      }
    });

    return Response.json({ execution });
  } catch (error) {
    return toErrorResponse(error, ctx.requestId);
  }
}
