import { prisma } from "@zynvex/database";
import { agentSchema } from "@/lib/input";
import { requestContext } from "@/lib/request";
import { requireSessionContext } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { toErrorResponse } from "@/lib/errors";

export async function GET(request: Request) {
  const ctx = requestContext(request);
  try {
    const session = await requireSessionContext();
    requirePermission(session.role, "agents.manage");

    const agents = await prisma.agent.findMany({
      where: { organizationId: session.organizationId, deletedAt: null },
      orderBy: { updatedAt: "desc" }
    });

    return Response.json({ agents });
  } catch (error) {
    return toErrorResponse(error, ctx.requestId);
  }
}

export async function POST(request: Request) {
  const ctx = requestContext(request);
  try {
    const session = await requireSessionContext();
    requirePermission(session.role, "agents.create");
    const body = agentSchema.parse(await request.json());

    const agent = await prisma.agent.create({
      data: {
        organizationId: session.organizationId,
        projectId: null,
        ownerId: session.userId,
        name: body.name,
        description: body.description,
        status: "ACTIVE",
        systemPrompt: body.systemPrompt,
        model: body.model,
        temperature: body.temperature,
        maxIterations: body.maxIterations,
        timeoutSeconds: body.timeoutSeconds
      }
    });

    await prisma.agentVersion.create({
      data: {
        organizationId: session.organizationId,
        agentId: agent.id,
        version: 1,
        snapshot: body
      }
    });

    return Response.json({ agent }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, ctx.requestId);
  }
}
