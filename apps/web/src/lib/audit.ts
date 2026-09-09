import { prisma } from "@zynvex/database";

export async function writeAuditLog(input: {
  organizationId: string;
  actorId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  result: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      organizationId: input.organizationId,
      actorId: input.actorId,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId,
      result: input.result,
      ipAddress: input.ipAddress,
      metadata: input.metadata
    }
  });
}
