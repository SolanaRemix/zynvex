import { prisma } from "@zynvex/database";
import { z } from "zod";
import { requestContext } from "@/lib/request";
import { requireSessionContext } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { generateApiKey } from "@/lib/api-key";
import { toErrorResponse } from "@/lib/errors";

const schema = z.object({
  name: z.string().min(1),
  scope: z.array(z.string()).min(1),
  expiration: z.string().datetime().optional()
});

export async function GET(request: Request) {
  const ctx = requestContext(request);
  try {
    const session = await requireSessionContext();
    requirePermission(session.role, "api_keys.manage");

    const keys = await prisma.apiKey.findMany({
      where: { organizationId: session.organizationId, revokedAt: null },
      orderBy: { createdAt: "desc" }
    });

    return Response.json({
      keys: keys.map((key: {
        id: string;
        name: string;
        scope: string[];
        keyPrefix: string;
        createdAt: Date;
        lastUsedAt: Date | null;
        expiresAt: Date | null;
      }) => ({
        id: key.id,
        name: key.name,
        scope: key.scope,
        keyPrefix: key.keyPrefix,
        createdAt: key.createdAt,
        lastUsedAt: key.lastUsedAt,
        expiresAt: key.expiresAt
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
    requirePermission(session.role, "api_keys.manage");
    const body = schema.parse(await request.json());

    const generated = generateApiKey();
    const key = await prisma.apiKey.create({
      data: {
        organizationId: session.organizationId,
        userId: session.userId,
        name: body.name,
        keyPrefix: generated.keyPrefix,
        keyHash: generated.keyHash,
        scope: body.scope,
        expiresAt: body.expiration ? new Date(body.expiration) : null
      }
    });

    return Response.json({
      key: {
        id: key.id,
        name: key.name,
        keyPrefix: key.keyPrefix,
        scope: key.scope,
        expiresAt: key.expiresAt,
        secret: generated.raw
      }
    }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, ctx.requestId);
  }
}
