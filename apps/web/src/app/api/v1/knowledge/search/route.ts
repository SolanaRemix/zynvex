import { prisma } from "@zynvex/database";
import { z } from "zod";
import { requestContext } from "@/lib/request";
import { requireSessionContext } from "@/lib/auth";
import { toErrorResponse } from "@/lib/errors";

const schema = z.object({ query: z.string().min(2), limit: z.number().min(1).max(20).default(5) });

export async function POST(request: Request) {
  const ctx = requestContext(request);
  try {
    const session = await requireSessionContext();
    const body = schema.parse(await request.json());

    const chunks = await prisma.documentChunk.findMany({
      where: {
        organizationId: session.organizationId,
        content: { contains: body.query, mode: "insensitive" }
      },
      take: body.limit
    });

    return Response.json({ results: chunks });
  } catch (error) {
    return toErrorResponse(error, ctx.requestId);
  }
}
