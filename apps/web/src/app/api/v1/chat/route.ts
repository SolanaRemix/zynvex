import { prisma } from "@zynvex/database";
import { modelRouter } from "@/lib/model-router";
import { requestContext } from "@/lib/request";
import { chatSchema } from "@/lib/input";
import { requireSessionContext } from "@/lib/auth";
import { ApiError, toErrorResponse } from "@/lib/errors";

export async function POST(request: Request) {
  const ctx = requestContext(request);
  try {
    const session = await requireSessionContext();
    const body = chatSchema.parse(await request.json());

    const conversation = body.conversationId
      ? await prisma.conversation.findFirst({
          where: {
            id: body.conversationId,
            organizationId: session.organizationId,
            deletedAt: null
          }
        })
      : await prisma.conversation.create({
          data: {
            organizationId: session.organizationId,
            projectId: body.projectId,
            userId: session.userId,
            title: body.prompt.slice(0, 80)
          }
        });

    if (!conversation) throw new ApiError("NOT_FOUND", 404, "Conversation not found");

    await prisma.message.create({
      data: {
        organizationId: session.organizationId,
        conversationId: conversation.id,
        role: "user",
        content: body.prompt
      }
    });

    const result = await modelRouter.run({
      prompt: body.systemInstruction ? `${body.systemInstruction}\n\n${body.prompt}` : body.prompt,
      model: body.model
    });

    await prisma.message.create({
      data: {
        organizationId: session.organizationId,
        conversationId: conversation.id,
        role: "assistant",
        content: result.output,
        model: result.model,
        usageInput: result.inputTokens,
        usageOutput: result.outputTokens,
        estimatedCost: result.estimatedCost
      }
    });

    await prisma.usageRecord.create({
      data: {
        organizationId: session.organizationId,
        projectId: body.projectId,
        provider: result.provider,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        estimatedCost: result.estimatedCost
      }
    });

    const encoder = new TextEncoder();
    const chunks = result.output.match(/.{1,60}/g) ?? [result.output];

    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "chunk", chunk })}\n\n`));
        }
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "done", conversationId: conversation.id, usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens, estimatedCost: result.estimatedCost, latencyMs: result.latencyMs, model: result.model, provider: result.provider } })}\n\n`
          )
        );
        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive"
      }
    });
  } catch (error) {
    return toErrorResponse(error, ctx.requestId);
  }
}
