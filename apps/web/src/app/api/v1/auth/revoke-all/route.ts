import { prisma } from "@zynvex/database";
import { requireSessionContext } from "@/lib/auth";
import { toErrorResponse } from "@/lib/errors";
import { requestContext } from "@/lib/request";

export async function POST(request: Request) {
  const ctx = requestContext(request);
  try {
    const session = await requireSessionContext();
    await prisma.session.deleteMany({ where: { userId: session.userId } });
    return Response.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error, ctx.requestId);
  }
}
