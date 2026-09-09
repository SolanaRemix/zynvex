import { prisma } from "@zynvex/database";
import { ApiError, toErrorResponse } from "@/lib/errors";
import { loginSchema } from "@/lib/input";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requestContext } from "@/lib/request";
import { verifyPassword, createSession, setSessionCookie } from "@/lib/auth";

export async function POST(request: Request) {
  const ctx = requestContext(request);

  try {
    enforceRateLimit(`login:${ctx.ip}`, 10, 60_000);

    const body = loginSchema.parse(await request.json());
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user?.passwordHash) throw new ApiError("UNAUTHORIZED", 401, "Invalid credentials");

    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) throw new ApiError("UNAUTHORIZED", 401, "Invalid credentials");

    const membership = await prisma.organizationMember.findFirst({ where: { userId: user.id } });
    if (!membership) throw new ApiError("UNAUTHORIZED", 401, "Organization membership required");

    const session = await createSession(user.id, membership.organizationId);
    await setSessionCookie(session.token, session.expiresAt);

    return Response.json({ user: { id: user.id, email: user.email, name: user.name }, organizationId: membership.organizationId });
  } catch (error) {
    return toErrorResponse(error, ctx.requestId);
  }
}
