import { prisma } from "@zynvex/database";
import { requestContext } from "@/lib/request";
import { requireSessionContext } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { agentExecutionSchema } from "@/lib/input";
import { enqueueAgentExecution } from "@/lib/execution";
import { ApiError, toErrorResponse } from "@/lib/errors";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const reqCtx = requestContext(request);
  try {
    const session = await requireSessionContext();
    requirePermission(session.role, "agents.execute");

    const { id } = await context.params;
    const body = agentExecutionSchema.parse(await request.json());

    const agent = await prisma.agent.findFirst({ where: { id, organizationId: session.organizationId, deletedAt: null } });
    if (!agent) throw new ApiError("NOT_FOUND", 404, "Agent not found");

    const execution = await enqueueAgentExecution({
      organizationId: session.organizationId,
      userId: session.userId,
      projectId: agent.projectId,
      agentId: agent.id,
      input: body.input,
      priority: body.priority,
      budget: body.budget,
      timeoutSeconds: body.timeoutSeconds,
      maxIterations: body.maxIterations,
      idempotencyKey: body.idempotencyKey
    });

    return Response.json({ execution }, { status: 202 });
  } catch (error) {
    return toErrorResponse(error, reqCtx.requestId);
  }
}
