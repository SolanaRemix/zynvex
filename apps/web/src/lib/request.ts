import { makeRequestId } from "./errors";

export function requestContext(request: Request) {
  return {
    requestId: request.headers.get("x-request-id") || makeRequestId(),
    ip: request.headers.get("x-forwarded-for") || "unknown"
  };
}
