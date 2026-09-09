import { prisma } from "@zynvex/database";
import { WORKFLOW_NODE_TYPES } from "@zynvex/workflows";
import { requestContext } from "@/lib/request";
import { workflowSchema } from "@/lib/input";
import { requireSessionContext } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { ApiError, toErrorResponse } from "@/lib/errors";

export async function GET(request: Request) {
  const ctx = requestContext(request);
  try {
    const session = await requireSessionContext();
    requirePermission(session.role, "workflows.create");

    const workflows = await prisma.workflow.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { updatedAt: "desc" }
    });
    return Response.json({ workflows });
  } catch (error) {
    return toErrorResponse(error, ctx.requestId);
  }
}

export async function POST(request: Request) {
  const ctx = requestContext(request);
  try {
    const session = await requireSessionContext();
    requirePermission(session.role, "workflows.create");

    const body = workflowSchema.parse(await request.json());
    for (const node of body.nodes) {
      if (!WORKFLOW_NODE_TYPES.includes(node.nodeType as (typeof WORKFLOW_NODE_TYPES)[number])) {
        throw new ApiError("INVALID_NODE", 400, `Unsupported node type: ${node.nodeType}`);
      }
    }

    const workflow = await prisma.workflow.create({
      data: {
        organizationId: session.organizationId,
        projectId: null,
        ownerId: session.userId,
        name: body.name,
        description: body.description,
        status: "ACTIVE"
      }
    });

    await prisma.workflowVersion.create({
      data: {
        organizationId: session.organizationId,
        workflowId: workflow.id,
        version: 1,
        definition: { nodes: body.nodes, edges: body.edges }
      }
    });

    await prisma.workflowNode.createMany({
      data: body.nodes.map((node) => ({
        organizationId: session.organizationId,
        workflowId: workflow.id,
        nodeType: node.nodeType,
        name: node.name,
        config: { ...node.config, nodeId: node.id, dependsOn: node.dependsOn },
        positionX: node.positionX,
        positionY: node.positionY
      }))
    });

    return Response.json({ workflow }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, ctx.requestId);
  }
}
