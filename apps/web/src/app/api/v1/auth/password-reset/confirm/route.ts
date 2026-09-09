import { prisma } from "@zynvex/database";
import { z } from "zod";
import { requestContext } from "@/lib/request";
import { ApiError, toErrorResponse } from "@/lib/errors";
import { hashPassword } from "@/lib/auth";

const schema = z.object({ token: z.string().min(1), password: z.string().min(12) });

export async function POST(request: Request) {
  const ctx = requestContext(request);
  try {
    const body = schema.parse(await request.json());
    const record = await prisma.systemSetting.findFirst({ where: { key: `password-reset:${body.token}` } });
    if (!record) throw new ApiError("NOT_FOUND", 404, "Reset token not found");

    const data = record.value as { userId: string; expiresAt: string };
    if (new Date(data.expiresAt) < new Date()) throw new ApiError("EXPIRED", 400, "Reset token expired");

    await prisma.user.update({ where: { id: data.userId }, data: { passwordHash: await hashPassword(body.password) } });
    await prisma.systemSetting.delete({ where: { id: record.id } });

    return Response.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error, ctx.requestId);
  }
}
