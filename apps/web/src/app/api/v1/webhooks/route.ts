import { prisma } from "@zynvex/database";
import { z } from "zod";
import { requestContext } from "@/lib/request";
import { requireSessionContext } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { encryptSecret, sha256 } from "@/lib/crypto";
import { toErrorResponse } from "@/lib/errors";

const schema = z.object({
  name: z.string().min(1).max(120),
  url: z.string().url(),
  events: z.array(z.string().min(1)).min(1),
  secret: z.string().min(16).max(256),
  enabled: z.boolean().default(true)
});

export async function GET(request: Request) {
  const ctx = requestContext(request);
  try {
    const session = await requireSessionContext();
    requirePermission(session.role, "agents.manage");

    const hooks = await prisma.webhook.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { createdAt: "desc" }
    });

    return Response.json({
      webhooks: hooks.map((hook) => ({
        id: hook.id,
        name: hook.name,
        url: hook.url,
        events: hook.events,
        enabled: hook.enabled,
        createdAt: hook.createdAt,
        updatedAt: hook.updatedAt
      }))
    });
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

    const webhook = await prisma.webhook.create({
      data: {
        organizationId: session.organizationId,
        name: body.name,
        url: body.url,
        secretHash: sha256(body.secret),
        secretCipher: encryptSecret(body.secret),
        events: body.events,
        enabled: body.enabled
      }
    });

    return Response.json({
      webhook: {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        events: webhook.events,
        enabled: webhook.enabled
      }
    }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, ctx.requestId);
  }
}
