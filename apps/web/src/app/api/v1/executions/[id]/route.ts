import { prisma } from "@zynvex/database";
import { requestContext } from "@/lib/request";
import { requireSessionContext } from "@/lib/auth";
import { ApiError, toErrorResponse } from "@/lib/errors";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = requestContext(request);
  try {
    const session = await requireSessionContext();
    const { id } = await context.params;

    const execution = await prisma.agentExecution.findFirst({
      where: { id, organizationId: session.organizationId }
    });

    if (!execution) throw new ApiError("NOT_FOUND", 404, "Execution not found");

    const steps = await prisma.agentExecutionStep.findMany({
      where: { executionId: execution.id, organizationId: session.organizationId },
      orderBy: { stepIndex: "asc" }
    });

    return Response.json({ execution, steps });
  } catch (error) {
    return toErrorResponse(error, ctx.requestId);
  }
}
