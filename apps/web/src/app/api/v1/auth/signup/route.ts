import { prisma } from "@zynvex/database";
import { ApiError, toErrorResponse } from "@/lib/errors";
import { hashPassword, createSession, setSessionCookie } from "@/lib/auth";
import { signupSchema } from "@/lib/input";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requestContext } from "@/lib/request";

export async function POST(request: Request) {
  const ctx = requestContext(request);

  try {
    enforceRateLimit(`signup:${ctx.ip}`, 10, 60_000);

    const body = signupSchema.parse(await request.json());
    const exists = await prisma.user.findUnique({ where: { email: body.email } });
    if (exists) throw new ApiError("CONFLICT", 409, "Email already in use");

    const organization = await prisma.organization.create({
      data: { name: `${body.name}'s Organization`, slug: crypto.randomUUID() }
    });

    const user = await prisma.user.create({
      data: {
        organizationId: organization.id,
        email: body.email,
        name: body.name,
        passwordHash: await hashPassword(body.password),
        emailVerifiedAt: new Date()
      }
    });

    await prisma.organizationMember.create({
      data: { organizationId: organization.id, userId: user.id, role: "OWNER" }
    });

    const session = await createSession(user.id, organization.id);
    await setSessionCookie(session.token, session.expiresAt);

    return Response.json({ user: { id: user.id, email: user.email, name: user.name }, organizationId: organization.id });
  } catch (error) {
    return toErrorResponse(error, ctx.requestId);
  }
}
