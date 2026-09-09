import { prisma } from "@zynvex/database";
import { requireSessionContext } from "@/lib/auth";
import { requestContext } from "@/lib/request";
import { toErrorResponse } from "@/lib/errors";
import { getTokenIntegrationState } from "@zynvex/blockchain";

export async function GET(request: Request) {
  const ctx = requestContext(request);
  try {
    const session = await requireSessionContext();

    const [projects, agents, runningTasks, queuedExecutions, pendingApprovals, usage, recentExecutions, securityEvents] = await Promise.all([
      prisma.project.count({ where: { organizationId: session.organizationId, deletedAt: null } }),
      prisma.agent.count({ where: { organizationId: session.organizationId, deletedAt: null } }),
      prisma.task.count({ where: { organizationId: session.organizationId, status: "RUNNING" } }),
      prisma.agentExecution.count({ where: { organizationId: session.organizationId, status: "QUEUED" } }),
      prisma.approvalRequest.count({ where: { organizationId: session.organizationId, status: "PENDING" } }),
      prisma.usageRecord.aggregate({
        where: { organizationId: session.organizationId, recordedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
        _sum: { estimatedCost: true }
      }),
      prisma.agentExecution.findMany({
        where: { organizationId: session.organizationId },
        orderBy: { createdAt: "desc" },
        take: 5
      }),
      prisma.auditLog.findMany({ where: { organizationId: session.organizationId }, orderBy: { createdAt: "desc" }, take: 5 })
    ]);

    return Response.json({
      activeProjects: projects,
      agents,
      runningTasks,
      queuedExecutions,
      pendingApprovals,
      blockchainStatus: getTokenIntegrationState(process.env),
      monthlyCost: usage._sum.estimatedCost ?? 0,
      recentExecutions,
      securityEvents
    });
  } catch (error) {
    return toErrorResponse(error, ctx.requestId);
  }
}
