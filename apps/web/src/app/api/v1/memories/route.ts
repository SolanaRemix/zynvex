import { Prisma, prisma } from "@zynvex/database";
import { requestContext } from "@/lib/request";
import { requireSessionContext } from "@/lib/auth";
import { memorySchema } from "@/lib/input";
import { toErrorResponse } from "@/lib/errors";

export async function GET(request: Request) {
  const ctx = requestContext(request);
  try {
    const session = await requireSessionContext();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query");
    const type = searchParams.get("type");

    const memories = await prisma.memory.findMany({
      where: {
        organizationId: session.organizationId,
        ownerId: session.userId,
        ...(type ? { type } : {}),
        AND: [
          { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
          ...(query
            ? [
                {
                  OR: [
                    { content: { contains: query, mode: Prisma.QueryMode.insensitive } },
                    { source: { contains: query, mode: Prisma.QueryMode.insensitive } }
                  ]
                }
              ]
            : [])
        ]
      },
      orderBy: [{ updatedAt: "desc" }, { confidence: "desc" }],
      take: 100
    });

    return Response.json({ memories });
  } catch (error) {
    return toErrorResponse(error, ctx.requestId);
  }
}

export async function POST(request: Request) {
  const ctx = requestContext(request);
  try {
    const session = await requireSessionContext();
    const body = memorySchema.parse(await request.json());

    const memory = await prisma.memory.create({
      data: {
        organizationId: session.organizationId,
        projectId: body.projectId,
        ownerId: session.userId,
        agentId: body.agentId,
        scope: body.scope,
        type: body.type,
        policy: body.policy,
        source: body.source,
        confidence: body.confidence,
        content: body.content,
        metadata: body.metadata,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null
      }
    });

    return Response.json({ memory }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, ctx.requestId);
  }
}
