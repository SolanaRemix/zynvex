import { prisma } from "@zynvex/database";
import { requestContext } from "@/lib/request";
import { requireSessionContext } from "@/lib/auth";
import { memorySchema } from "@/lib/input";
import { ApiError, toErrorResponse } from "@/lib/errors";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = requestContext(request);
  try {
    const session = await requireSessionContext();
    const body = memorySchema.partial().parse(await request.json());
    const { id } = await context.params;

    const existing = await prisma.memory.findFirst({
      where: { id, organizationId: session.organizationId, ownerId: session.userId }
    });
    if (!existing) throw new ApiError("NOT_FOUND", 404, "Memory not found");

    const memory = await prisma.memory.update({
      where: { id: existing.id },
      data: {
        scope: body.scope,
        type: body.type,
        policy: body.policy,
        source: body.source,
        confidence: body.confidence,
        content: body.content,
        metadata: body.metadata,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : body.expiresAt === undefined ? undefined : null
      }
    });

    return Response.json({ memory });
  } catch (error) {
    return toErrorResponse(error, ctx.requestId);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = requestContext(request);
  try {
    const session = await requireSessionContext();
    const { id } = await context.params;

    const existing = await prisma.memory.findFirst({
      where: { id, organizationId: session.organizationId, ownerId: session.userId }
    });
    if (!existing) throw new ApiError("NOT_FOUND", 404, "Memory not found");

    await prisma.memory.delete({ where: { id: existing.id } });
    return Response.json({ deleted: true });
  } catch (error) {
    return toErrorResponse(error, ctx.requestId);
  }
}
