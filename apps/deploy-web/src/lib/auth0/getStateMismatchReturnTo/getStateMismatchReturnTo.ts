import { CallbackHandlerError } from "@src/lib/auth0";

/** Only the path of a return url survives, so this base exists to make a relative one parseable and never validates the origin. */
const URL_PARSE_BASE = "https://console.akash.network";

interface StateMismatchCause extends Error {
  checks?: { state?: string };
  params?: { state?: string };
}

/** Resolves the path the returning login was headed for once a newer login start has replaced the transaction cookie, or undefined for any other error. */
export function getStateMismatchReturnTo(error: unknown): string | undefined {
  if (!(error instanceof CallbackHandlerError)) return undefined;

  const { checks, params } = error.cause as StateMismatchCause;

  if (!checks?.state || !params?.state || checks.state === params.state) return undefined;

  return toReturnToPath(params.state);
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
