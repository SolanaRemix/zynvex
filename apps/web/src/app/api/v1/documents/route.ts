import { prisma } from "@zynvex/database";
import { requireSessionContext } from "@/lib/auth";
import { requestContext } from "@/lib/request";
import { ApiError, toErrorResponse } from "@/lib/errors";
import { isSupportedDocumentType } from "@zynvex/rag";

const MAX_SIZE = 20 * 1024 * 1024;

export async function POST(request: Request) {
  const ctx = requestContext(request);
  try {
    const session = await requireSessionContext();
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) throw new ApiError("BAD_REQUEST", 400, "file is required");
    if (file.size > MAX_SIZE) throw new ApiError("FILE_TOO_LARGE", 413, "File exceeds size limit");
    if (!isSupportedDocumentType(file.type)) throw new ApiError("UNSUPPORTED_TYPE", 400, "Unsupported document type");

    if (!process.env.S3_BUCKET || !process.env.S3_ENDPOINT || !process.env.S3_ACCESS_KEY || !process.env.S3_SECRET_KEY) {
      throw new ApiError("NOT_CONFIGURED", 400, "Object storage not configured");
    }

    const document = await prisma.document.create({
      data: {
        organizationId: session.organizationId,
        projectId: null,
        knowledgeBaseId: null,
        title: file.name,
        sourceType: file.type,
        status: "UPLOADED"
      }
    });

    await prisma.attachment.create({
      data: {
        organizationId: session.organizationId,
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        storageKey: `${session.organizationId}/${document.id}/${file.name}`,
        documentId: document.id
      }
    });

    return Response.json({ document });
  } catch (error) {
    return toErrorResponse(error, ctx.requestId);
  }
}
