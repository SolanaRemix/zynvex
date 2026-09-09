import { prisma } from "@zynvex/database";
import { z } from "zod";
import { requestContext } from "@/lib/request";
import { toErrorResponse } from "@/lib/errors";

const schema = z.object({ email: z.string().email() });

export async function POST(request: Request) {
  const ctx = requestContext(request);
  try {
    const body = schema.parse(await request.json());
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (user) {
      await prisma.systemSetting.create({
        data: {
          organizationId: user.organizationId,
          key: `password-reset:${crypto.randomUUID()}`,
          value: { userId: user.id, expiresAt: new Date(Date.now() + 15 * 60_000).toISOString() }
        }
      });
    }

    return Response.json({ ok: true, message: "If account exists, a reset token was generated." });
  } catch (error) {
    return toErrorResponse(error, ctx.requestId);
  }
}
