import { requireSessionContext } from "@/lib/auth";
import { requestContext } from "@/lib/request";
import { toErrorResponse } from "@/lib/errors";

export async function GET(request: Request) {
  const ctx = requestContext(request);
  try {
    return Response.json(await requireSessionContext());
  } catch (error) {
    return toErrorResponse(error, ctx.requestId);
  }
}
