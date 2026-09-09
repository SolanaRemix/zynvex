import { prisma } from "@zynvex/database";
import { z } from "zod";
import { requestContext } from "@/lib/request";
import { requireSessionContext } from "@/lib/auth";
import { toErrorResponse } from "@/lib/errors";

const schema = z.object({
  query: z.string().min(2),
  limit: z.number().min(1).max(20).default(5),
  projectId: z.string().uuid().optional(),
  knowledgeBaseId: z.string().uuid().optional(),
  documentId: z.string().uuid().optional()
});

export async function POST(request: Request) {
  const ctx = requestContext(request);
  try {
    const session = await requireSessionContext();
    const body = schema.parse(await request.json());

    const chunks = await prisma.documentChunk.findMany({
      where: {
        organizationId: session.organizationId,
        content: { contains: body.query, mode: "insensitive" },
        ...(body.documentId ? { documentId: body.documentId } : {})
      },
      take: body.limit
    });

    if (!chunks.length) {
      return Response.json({ results: [] });
    }

    const documents = await prisma.document.findMany({
      where: {
        organizationId: session.organizationId,
        id: { in: chunks.map((chunk) => chunk.documentId) },
        ...(body.projectId ? { projectId: body.projectId } : {}),
        ...(body.knowledgeBaseId ? { knowledgeBaseId: body.knowledgeBaseId } : {})
      }
    });

    const allowedDocumentIds = new Set(documents.map((document) => document.id));
    const results = chunks
      .filter((chunk) => allowedDocumentIds.has(chunk.documentId))
      .map((chunk) => {
        const document = documents.find((candidate) => candidate.id === chunk.documentId);
        return {
          id: chunk.id,
          documentId: chunk.documentId,
          documentTitle: document?.title ?? "Unknown document",
          excerpt: chunk.content.slice(0, 400),
          metadata: chunk.metadata
        };
      });

    return Response.json({ results });
  } catch (error) {
    return toErrorResponse(error, ctx.requestId);
  }
}
