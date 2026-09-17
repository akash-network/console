import { isHttpError } from "@akashnetwork/http-sdk";
import { ApiError } from "@akashnetwork/openapi-sdk";

const MAX_SERVER_ERROR_RETRIES = 3;

/** The provider proxy answers 502 when it cannot reach the provider host and 503 when the provider itself failed. */
const PROVIDER_UNAVAILABLE_STATUSES = [502, 503];

/** Server errors are usually transient, so they get a few attempts. Everything else fails on the first try. */
export function retryOnServerError(failureCount: number, error: unknown): boolean {
  return isServerError(error) && failureCount < MAX_SERVER_ERROR_RETRIES;
}

function isServerError(error: unknown): boolean {
  if (error instanceof ApiError) return error.status >= 500;

  return isHttpError(error) && !!error.response && error.response.status >= 500;
}

/**
 * Whether a request failed because the provider behind the proxy is down rather than because Console is.
 * Only meaningful for calls that go through the provider proxy, since it owns these two statuses.
 */
export function isProviderUnavailableError(error: unknown): boolean {
  return isHttpError(error) && !!error.response && PROVIDER_UNAVAILABLE_STATUSES.includes(error.response.status);
}

/**
 * Whether the proxy rejected the call's provider JWT. It validates the payload before it dials and answers 400
 * with a zod issue on `auth.token`, so a caller holding a token the proxy considers expired can tell that apart
 * from every other 400 and mint a fresh one.
 */
export function isProviderTokenRejection(error: unknown): boolean {
  if (!isHttpError(error) || error.response?.status !== 400) return false;

  const issues = (error.response.data as { error?: { issues?: unknown } } | undefined)?.error?.issues;
  return Array.isArray(issues) && issues.some(issue => Array.isArray(issue?.path) && issue.path.join(".") === "auth.token");
}

function isClientError(error: unknown): boolean {
  return isHttpError(error) && !!error.response && error.response.status >= 400 && error.response.status < 500;
}

/**
 * Queries and mutations opt out of error reporting by putting a predicate on React Query's `meta`, which is the
 * documented way to hand per-call policy to the global cache handlers.
 */
export function shouldReportError(error: unknown, meta: Record<string, unknown> | undefined): boolean {
  const skipErrorReporting = meta?.skipErrorReporting;
  return typeof skipErrorReporting === "function" ? !skipErrorReporting(error) : true;
}

/**
 * Provider polls are best-effort and degrade in the UI on their own. A 4xx is the caller's or the provider's
 * and a 502/503 is the provider being down, so neither is a Console fault error reporting can act on.
 */
export const SKIP_REPORTING_PROVIDER_POLL_FAILURE = {
  skipErrorReporting: (error: unknown) => isProviderUnavailableError(error) || isClientError(error)
};

/** Opt out for call sites whose own onError reports the failure with tags the cache handler has no way to know. */
export const SKIP_REPORTING_HANDLED_BY_CALLER = { skipErrorReporting: () => true };
