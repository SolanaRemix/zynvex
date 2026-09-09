import { prisma } from "@zynvex/database";
import { AGENT_PIPELINE } from "@zynvex/agents";
import { z } from "zod";
import { requestContext } from "@/lib/request";
import { requireSessionContext } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { modelRouter } from "@/lib/model-router";
import { ApiError, toErrorResponse } from "@/lib/errors";

const schema = z.object({ input: z.string().min(1) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const reqCtx = requestContext(request);
  try {
    const session = await requireSessionContext();
    requirePermission(session.role, "agents.execute");

    const { id } = await context.params;
    const body = schema.parse(await request.json());

    const agent = await prisma.agent.findFirst({ where: { id, organizationId: session.organizationId, deletedAt: null } });
    if (!agent) throw new ApiError("NOT_FOUND", 404, "Agent not found");

    const execution = await prisma.agentExecution.create({
      data: {
        organizationId: session.organizationId,
        projectId: agent.projectId,
        agentId: agent.id,
        startedById: session.userId,
        status: "RUNNING",
        input: { text: body.input }
      }
    });

    for (const [stepIndex, stage] of AGENT_PIPELINE.entries()) {
      await prisma.agentExecutionStep.create({
        data: {
          organizationId: session.organizationId,
          executionId: execution.id,
          stepIndex,
          stage,
          payload: stage === "REQUEST" ? { input: body.input } : undefined
        }
      });
    }

    const result = await modelRouter.run({ prompt: body.input, model: agent.model });

    const completed = await prisma.agentExecution.update({
      where: { id: execution.id },
      data: {
        status: "COMPLETED",
        output: { text: result.output },
        completedAt: new Date(),
        cost: result.estimatedCost
      }
    });

    return Response.json({ execution: completed, usage: result });
  } catch (error) {
    return toErrorResponse(error, reqCtx.requestId);
  }
}
