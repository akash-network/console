import { ApplicationError, CallbackHandlerError } from "@src/lib/auth0";

/** Only the path of a return url survives, so this base exists to make a relative one parseable and never validates the origin. */
const URL_PARSE_BASE = "https://console.akash.network";

/** nextjs-auth0 rethrows openid-client's state check as an ApplicationError that keeps only this message. */
const STATE_MISMATCH_MESSAGE = /^state mismatch, expected \S+, got: (.+)/s;

/** Resolves the path the returning login was headed for once a newer login start has replaced the transaction cookie, or undefined for any other error. */
export function getStateMismatchReturnTo(error: unknown): string | undefined {
  if (!(error instanceof CallbackHandlerError) || !(error.cause instanceof ApplicationError)) return undefined;

  const callbackState = STATE_MISMATCH_MESSAGE.exec(error.cause.message)?.[1];

  return callbackState === undefined ? undefined : toReturnToPath(callbackState);
}

function toReturnToPath(state: string): string {
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString()) as { returnTo?: unknown };

    if (typeof decoded.returnTo !== "string") return "/";

    const { pathname, search } = new URL(decoded.returnTo, URL_PARSE_BASE);

    return `${pathname}${search}`;
  } catch {
    return "/";
  }
}
