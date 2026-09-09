export class ApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
  }
}

export function makeRequestId() {
  return crypto.randomUUID();
}

export function toErrorResponse(error: unknown, requestId: string) {
  if (error instanceof ApiError) {
    return Response.json(
      { code: error.code, message: error.message, requestId, details: error.details ?? null },
      { status: error.status }
    );
  }

  return Response.json(
    { code: "INTERNAL_ERROR", message: "Internal server error", requestId, details: null },
    { status: 500 }
  );
}
