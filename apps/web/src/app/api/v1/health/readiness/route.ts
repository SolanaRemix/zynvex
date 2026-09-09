import { prisma } from "@zynvex/database";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ready" });
  } catch {
    return Response.json({ status: "not_ready" }, { status: 503 });
  }
}
