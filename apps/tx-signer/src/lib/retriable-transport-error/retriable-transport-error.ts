import { isRetriableError } from "@akashnetwork/http-sdk";

const BAD_STATUS_5XX_RE = /Bad status on response: 5\d{2}/;

/**
 * `AbortSignal.timeout` rejects with a `DOMException` whose `code` is the legacy numeric 23, so only its `name`
 * identifies it as a per-request timeout rather than an application failure.
 */
const ABORTED_ERROR_NAMES = new Set(["TimeoutError", "AbortError"]);

export function isRetriableTransportError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (BAD_STATUS_5XX_RE.test(error.message)) return true;
  if (isAborted(error)) return true;
  if ("code" in error && isRetriableError(error as Error & { code: unknown })) return true;
  if (error.cause instanceof Error) {
    if (isAborted(error.cause)) return true;
    if ("code" in error.cause) return isRetriableError(error.cause as Error & { code: unknown });
  }
  return false;
}

function isAborted(error: Error): boolean {
  return ABORTED_ERROR_NAMES.has(error.name);
}
