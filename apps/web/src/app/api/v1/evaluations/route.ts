import { prisma } from "@zynvex/database";
import { z } from "zod";
import { requestContext } from "@/lib/request";
import { requireSessionContext } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { toErrorResponse } from "@/lib/errors";

const caseSchema = z.object({
  key: z.string().min(1),
  input: z.string().min(1),
  expectedContains: z.array(z.string()).default([])
});

const schema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  agentId: z.string().uuid().optional(),
  workflowId: z.string().uuid().optional(),
  cases: z.array(caseSchema).min(1)
});

export async function GET(request: Request) {
  const ctx = requestContext(request);
  try {
    const session = await requireSessionContext();
    requirePermission(session.role, "agents.manage");

    const evaluations = await prisma.evaluation.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { updatedAt: "desc" }
    });

    return Response.json({ evaluations });
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

    const evaluation = await prisma.evaluation.create({
      data: {
        organizationId: session.organizationId,
        agentId: body.agentId,
        workflowId: body.workflowId,
        name: body.name,
        description: body.description,
        cases: body.cases
      }
    });

    return Response.json({ evaluation }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, ctx.requestId);
  }
}
