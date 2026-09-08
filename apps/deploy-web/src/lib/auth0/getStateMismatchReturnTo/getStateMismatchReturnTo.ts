import { CallbackHandlerError } from "@src/lib/auth0";

interface StateMismatchCause {
  checks: { state?: string };
  params: { state?: string };
}

/** Resolves the relative path a login should return to when the callback state was overwritten by a newer login start, or undefined for any other error. */
export function getStateMismatchReturnTo(error: unknown): string | undefined {
  if (!(error instanceof CallbackHandlerError) || !isStateMismatchCause(error.cause)) {
    return undefined;
  }

  return toRelativePath(decodeReturnTo(error.cause.params.state));
}

function isStateMismatchCause(cause: unknown): cause is StateMismatchCause & { params: { state: string } } {
  if (typeof cause !== "object" || cause === null) return false;

  const { checks, params } = cause as Partial<StateMismatchCause>;
  return typeof checks?.state === "string" && typeof params?.state === "string" && checks.state !== params.state;
}

function decodeReturnTo(state: string): string | undefined {
  try {
    const decoded: unknown = JSON.parse(Buffer.from(state, "base64url").toString());
    return typeof decoded === "object" && decoded !== null && typeof (decoded as { returnTo?: unknown }).returnTo === "string"
      ? (decoded as { returnTo: string }).returnTo
      : undefined;
  } catch {
    return undefined;
  }
}

function toRelativePath(returnTo: string | undefined): string {
  if (!returnTo) return "/";

  try {
    const url = new URL(returnTo, "http://localhost");
    return `${url.pathname}${url.search}`;
  } catch {
    return "/";
  }
}
