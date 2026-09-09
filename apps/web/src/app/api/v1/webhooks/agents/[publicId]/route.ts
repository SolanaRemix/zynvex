import { prisma } from "@zynvex/database";
import { requestContext } from "@/lib/request";
import { ApiError, toErrorResponse } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enqueueAgentExecution, verifyAgentWebhookSignature } from "@/lib/execution";

const MAX_PAYLOAD_BYTES = 256 * 1024;

export async function POST(request: Request, context: { params: Promise<{ publicId: string }> }) {
  const ctx = requestContext(request);
  try {
    const { publicId } = await context.params;
    const rawBody = await request.text();
    if (rawBody.length > MAX_PAYLOAD_BYTES) {
      throw new ApiError("PAYLOAD_TOO_LARGE", 413, "Webhook payload exceeds the size limit");
    }

    const trigger = await verifyAgentWebhookSignature({
      publicId,
      signature: request.headers.get("x-zynvex-signature"),
      timestamp: request.headers.get("x-zynvex-timestamp"),
      body: rawBody
    });

    enforceRateLimit(`agent-webhook:${trigger.id}`, trigger.rateLimitPerMinute, 60_000);

    const payload = rawBody ? JSON.parse(rawBody) : {};
    const eventName = typeof payload.event === "string" ? payload.event : "webhook.received";
    const allowedEvents = Array.isArray(trigger.allowedEvents) ? trigger.allowedEvents.map(String) : ["*"];
    if (!allowedEvents.includes("*") && !allowedEvents.includes(eventName)) {
      throw new ApiError("FORBIDDEN", 403, "Webhook event is not allowed");
    }

    const agent = await prisma.agent.findFirst({
      where: { id: trigger.agentId, organizationId: trigger.organizationId, deletedAt: null }
    });
    if (!agent) throw new ApiError("NOT_FOUND", 404, "Agent not found");

    const execution = await enqueueAgentExecution({
      organizationId: trigger.organizationId,
      userId: agent.ownerId,
      projectId: agent.projectId,
      agentId: agent.id,
      input: JSON.stringify(payload.payload ?? payload),
      triggerType: "WEBHOOK",
      triggerId: trigger.id,
      idempotencyKey: request.headers.get("x-zynvex-idempotency-key") ?? undefined
    });

    await prisma.agentWebhookTrigger.update({
      where: { id: trigger.id },
      data: { lastTriggeredAt: new Date() }
    });

    return Response.json({ accepted: true, executionId: execution.id }, { status: 202 });
  } catch (error) {
    return toErrorResponse(error, ctx.requestId);
  }
}
