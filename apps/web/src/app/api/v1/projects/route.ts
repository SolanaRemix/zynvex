import { prisma } from "@zynvex/database";
import { requireSessionContext } from "@/lib/auth";
import { projectSchema } from "@/lib/input";
import { requestContext } from "@/lib/request";
import { requirePermission } from "@/lib/rbac";
import { toErrorResponse } from "@/lib/errors";
import { writeAuditLog } from "@/lib/audit";

export async function GET(request: Request) {
  const ctx = requestContext(request);
  try {
    const session = await requireSessionContext();
    requirePermission(session.role, "projects.read");

    const projects = await prisma.project.findMany({
      where: { organizationId: session.organizationId, deletedAt: null },
      orderBy: { createdAt: "desc" }
    });

    return Response.json({ projects });
  } catch (error) {
    return toErrorResponse(error, ctx.requestId);
  }
}

export async function POST(request: Request) {
  const ctx = requestContext(request);
  try {
    const session = await requireSessionContext();
    requirePermission(session.role, "projects.create");

    const body = projectSchema.parse(await request.json());
    const project = await prisma.project.create({
      data: {
        organizationId: session.organizationId,
        ownerId: session.userId,
        name: body.name,
        description: body.description
      }
    });

    await writeAuditLog({
      organizationId: session.organizationId,
      actorId: session.userId,
      action: "project.create",
      resource: "project",
      resourceId: project.id,
      result: "success",
      ipAddress: ctx.ip
    });

    return Response.json({ project }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, ctx.requestId);
  }
}
