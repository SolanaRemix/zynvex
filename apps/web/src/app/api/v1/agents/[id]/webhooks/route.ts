import { prisma } from "@zynvex/database";
import { requestContext } from "@/lib/request";
import { requireSessionContext } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { webhookTriggerSchema } from "@/lib/input";
import { createAgentWebhookTrigger } from "@/lib/execution";
import { ApiError, toErrorResponse } from "@/lib/errors";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = requestContext(request);
  try {
    const session = await requireSessionContext();
    requirePermission(session.role, "agents.manage");
    const { id } = await context.params;

    const triggers = await prisma.agentWebhookTrigger.findMany({
      where: { organizationId: session.organizationId, agentId: id },
      orderBy: { createdAt: "desc" }
    });

    return Response.json({
      triggers: triggers.map((trigger) => ({
        ...trigger,
        secretHash: undefined,
        secretCipher: undefined
      }))
    });
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
    const body = webhookTriggerSchema.parse(await request.json());

    const agent = await prisma.agent.findFirst({
      where: { id, organizationId: session.organizationId, deletedAt: null }
    });
    if (!agent) throw new ApiError("NOT_FOUND", 404, "Agent not found");

    const { trigger, secret } = await createAgentWebhookTrigger({
      organizationId: session.organizationId,
      agentId: agent.id,
      allowedEvents: body.allowedEvents,
      rateLimitPerMinute: body.rateLimitPerMinute
    });

    return Response.json({
      trigger: {
        ...trigger,
        secretHash: undefined,
        secretCipher: undefined
      },
      secret
    }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, ctx.requestId);
  }
}
