export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.status = status;
    this.body = body;
    this.name = "ApiError";
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Reads `body.message` from an ApiError. ApiError.message itself carries
 * transport info (e.g. "DELETE /v1/foo → 400"); the human-readable text from
 * the backend (NestJS exceptions, RFC 7807 problem details with a `message`
 * field, etc.) sits in `body.message`. Returns null when the body doesn't
 * follow that shape or the input isn't an ApiError.
 */
export function extractApiErrorMessage(error: unknown): string | null {
  return extractApiErrorBodyString(error, "message");
}

/**
 * Reads `body.code` from an ApiError — the machine-readable identifier some
 * backends attach to error responses (e.g. NestJS `{ code: "RESOURCE_NOT_FOUND" }`).
 * Returns null when the body doesn't follow that shape or the input isn't
 * an ApiError.
 */
export function extractApiErrorCode(error: unknown): string | null {
  return extractApiErrorBodyString(error, "code");
}

function extractApiErrorBodyString(error: unknown, key: "message" | "code"): string | null {
  if (!isApiError(error)) return null;
  const body = error.body;
  if (!body || typeof body !== "object" || !(key in body)) return null;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}
