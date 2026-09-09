import { requestContext } from "@/lib/request";
import { ApiError, toErrorResponse } from "@/lib/errors";

export async function GET(request: Request) {
  const ctx = requestContext(request);
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    if (!code) throw new ApiError("INVALID_REQUEST", 400, "Missing OAuth code");

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
      throw new ApiError("NOT_CONFIGURED", 400, "Google OAuth not configured");
    }

    return Response.json({
      configured: true,
      message: "OAuth callback received. Complete token exchange and profile provisioning in deployment environment.",
      codeReceived: true
    });
  } catch (error) {
    return toErrorResponse(error, ctx.requestId);
  }
}
