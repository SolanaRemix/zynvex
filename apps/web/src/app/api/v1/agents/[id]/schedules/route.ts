import { prisma } from "@zynvex/database";
import { requestContext } from "@/lib/request";
import { requireSessionContext } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { scheduleSchema } from "@/lib/input";
import { createAgentSchedule } from "@/lib/execution";
import { ApiError, toErrorResponse } from "@/lib/errors";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = requestContext(request);
  try {
    const session = await requireSessionContext();
    requirePermission(session.role, "agents.manage");
    const { id } = await context.params;

    const schedules = await prisma.agentSchedule.findMany({
      where: { organizationId: session.organizationId, agentId: id },
      orderBy: { createdAt: "desc" }
    });

    return Response.json({ schedules });
  } catch (error) {
    return toErrorResponse(error, ctx.requestId);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = requestContext(request);
  try {
    const session = await requireSessionContext();
    requirePermission(session.role, "agents.manage");
    const { id } = await context.params;
    const body = scheduleSchema.parse(await request.json());

    const agent = await prisma.agent.findFirst({
      where: { id, organizationId: session.organizationId, deletedAt: null }
    });
    if (!agent) throw new ApiError("NOT_FOUND", 404, "Agent not found");

    const schedule = await createAgentSchedule({
      organizationId: session.organizationId,
      agentId: agent.id,
      schedule: body.schedule,
      timezone: body.timezone,
      input: body.input
    });

    return Response.json({ schedule }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, ctx.requestId);
  }
}
