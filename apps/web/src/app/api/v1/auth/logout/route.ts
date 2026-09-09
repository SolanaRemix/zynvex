import { cookies } from "next/headers";
import { prisma } from "@zynvex/database";
import { toErrorResponse } from "@/lib/errors";
import { requestContext } from "@/lib/request";
import { clearSessionCookie } from "@/lib/auth";

export async function POST(request: Request) {
  const ctx = requestContext(request);
  try {
    const token = (await cookies()).get("zynvex_session")?.value;
    if (token) {
      await prisma.session.deleteMany({ where: { token } });
    }
    await clearSessionCookie();
    return Response.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error, ctx.requestId);
  }
}
