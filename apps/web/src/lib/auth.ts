import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "@zynvex/database";
import { ApiError } from "./errors";

const SESSION_COOKIE = "zynvex_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function createSession(userId: string, organizationId: string) {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: {
      userId,
      organizationId,
      token,
      expiresAt
    }
  });

  return { token, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.APP_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { path: "/", expires: new Date(0), httpOnly: true, sameSite: "lax" });
}

export async function getSessionContext() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findFirst({
    where: { token, expiresAt: { gt: new Date() } }
  });
  if (!session) return null;

  const membership = await prisma.organizationMember.findFirst({
    where: { organizationId: session.organizationId, userId: session.userId }
  });

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || !membership) return null;

  return {
    userId: user.id,
    email: user.email,
    organizationId: session.organizationId,
    role: membership.role
  };
}

export async function requireSessionContext() {
  const ctx = await getSessionContext();
  if (!ctx) throw new ApiError("UNAUTHORIZED", 401, "Authentication required");
  return ctx;
}
