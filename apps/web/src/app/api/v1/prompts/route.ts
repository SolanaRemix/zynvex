import { prisma } from "@zynvex/database";
import { z } from "zod";
import { requestContext } from "@/lib/request";
import { requireSessionContext } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { toErrorResponse } from "@/lib/errors";

const schema = z.object({
  name: z.string().min(1).max(120),
  version: z.string().min(1).max(40),
  content: z.string().min(1).max(20_000),
  variables: z.record(z.string(), z.string()).optional(),
  status: z.enum(["DRAFT", "TESTING", "PUBLISHED", "ARCHIVED"]).default("DRAFT")
});

export async function GET(request: Request) {
  const ctx = requestContext(request);
  try {
    const session = await requireSessionContext();
    requirePermission(session.role, "agents.manage");

    const prompts = await prisma.prompt.findMany({
      where: { organizationId: session.organizationId },
      orderBy: [{ name: "asc" }, { version: "desc" }]
    });

    return Response.json({ prompts });
  } catch (error) {
    return toErrorResponse(error, ctx.requestId);
  }
}

export async function POST(request: Request) {
  const ctx = requestContext(request);
  try {
    const session = await requireSessionContext();
    requirePermission(session.role, "agents.manage");
    const body = schema.parse(await request.json());

    const prompt = await prisma.prompt.create({
      data: {
        organizationId: session.organizationId,
        name: body.name,
        version: body.version,
        content: body.content,
        variables: body.variables,
        status: body.status,
        createdById: session.userId,
        publishedAt: body.status === "PUBLISHED" ? new Date() : null,
        archivedAt: body.status === "ARCHIVED" ? new Date() : null
      }
    });

    return Response.json({ prompt }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, ctx.requestId);
  }
}
