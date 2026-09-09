import { prisma } from "@zynvex/database";
import { requestContext } from "@/lib/request";
import { requireSessionContext } from "@/lib/auth";
import { toErrorResponse } from "@/lib/errors";

export async function GET(request: Request) {
  const ctx = requestContext(request);
  try {
    const session = await requireSessionContext();
    const notifications = await prisma.notification.findMany({
      where: { organizationId: session.organizationId, userId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 50
    });

    const unreadCount = await prisma.notification.count({
      where: { organizationId: session.organizationId, userId: session.userId, readAt: null }
    });

    return Response.json({ notifications, unreadCount });
  } catch (error) {
    return toErrorResponse(error, ctx.requestId);
  }
}
