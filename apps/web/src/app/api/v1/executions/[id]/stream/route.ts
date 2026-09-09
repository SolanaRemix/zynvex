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

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let attempts = 0;
        let emittedCount = 0;

        while (attempts < 30) {
          const [current, timeline] = await Promise.all([
            prisma.agentExecution.findFirst({
              where: { id, organizationId: session.organizationId }
            }),
            prisma.agentExecutionTransition.findMany({
              where: { executionId: id, organizationId: session.organizationId },
              orderBy: { createdAt: "asc" }
            })
          ]);

          for (const transition of timeline.slice(emittedCount)) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "timeline",
                  event: transition.status,
                  summary: transition.summary,
                  createdAt: transition.createdAt
                })}\n\n`
              )
            );
          }
          emittedCount = timeline.length;

          if (current && ["COMPLETED", "FAILED", "CANCELLED", "TIMEOUT", "BUDGET_EXCEEDED"].includes(current.status)) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", status: current.status, output: current.output })}\n\n`));
            controller.close();
            return;
          }

          attempts += 1;
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "timeout" })}\n\n`));
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
