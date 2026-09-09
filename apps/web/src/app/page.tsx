import { prisma } from "@zynvex/database";
import { getTokenIntegrationState } from "@zynvex/blockchain";
import { AuthPanel } from "@/components/auth-panel";
import { CommandPalette } from "@/components/command-palette";
import { Dashboard } from "@/components/dashboard";
import { getSessionContext } from "@/lib/auth";

export default async function Home() {
  const session = await getSessionContext();

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
        <div className="mx-auto max-w-5xl pt-10">
          <AuthPanel />
        </div>
        <CommandPalette />
      </div>
    );
  }

  const [projects, agents, runningTasks, queuedExecutions, pendingApprovals, usage] = await Promise.all([
    prisma.project.count({ where: { organizationId: session.organizationId, deletedAt: null } }),
    prisma.agent.count({ where: { organizationId: session.organizationId, deletedAt: null } }),
    prisma.task.count({ where: { organizationId: session.organizationId, status: "RUNNING" } }),
    prisma.agentExecution.count({ where: { organizationId: session.organizationId, status: "QUEUED" } }),
    prisma.approvalRequest.count({ where: { organizationId: session.organizationId, status: "PENDING" } }),
    prisma.usageRecord.aggregate({
      where: { organizationId: session.organizationId, recordedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
      _sum: { estimatedCost: true }
    })
  ]);

  return (
    <>
      <Dashboard
        homeData={{
          activeProjects: projects,
          agents,
          runningTasks,
          queuedExecutions,
          pendingApprovals,
          monthlyCost: Number(usage._sum.estimatedCost ?? 0),
          blockchainStatus: getTokenIntegrationState(process.env)
        }}
      />
      <CommandPalette />
    </>
  );
}
