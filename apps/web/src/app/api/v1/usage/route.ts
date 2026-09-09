import { prisma } from "@zynvex/database";
import { requestContext } from "@/lib/request";
import { requireSessionContext } from "@/lib/auth";
import { toErrorResponse } from "@/lib/errors";

export async function GET(request: Request) {
  const ctx = requestContext(request);
  try {
    const session = await requireSessionContext();

    const usage = await prisma.usageRecord.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { recordedAt: "desc" },
      take: 100
    });

    return Response.json({ usage });
  } catch (error) {
    return toErrorResponse(error, ctx.requestId);
  }
}
