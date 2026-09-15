import { isHttpError } from "@akashnetwork/http-sdk";
import { ApiError } from "@akashnetwork/openapi-sdk";

const MAX_SERVER_ERROR_RETRIES = 3;

/** The provider proxy answers 502 when it cannot reach the provider host and 503 when the provider itself failed. */
const PROVIDER_UNAVAILABLE_STATUSES = [502, 503];

/**
 * Server errors are usually transient, so they get a few attempts. Everything else fails on the first try.
 * The typed API client raises its own error rather than an axios one, so it is recognised separately.
 */
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
 * Queries and mutations opt out of error reporting by putting a predicate on React Query's `meta`, which is the
 * documented way to hand per-call policy to the global cache handlers.
 */
export function shouldReportError(error: unknown, meta: Record<string, unknown> | undefined): boolean {
  const skipErrorReporting = meta?.skipErrorReporting;
  return typeof skipErrorReporting === "function" ? !skipErrorReporting(error) : true;
}

export const SKIP_REPORTING_PROVIDER_UNAVAILABLE = { skipErrorReporting: isProviderUnavailableError };

/** Opt out for call sites whose own onError reports the failure with tags the cache handler has no way to know. */
export const SKIP_REPORTING_HANDLED_BY_CALLER = { skipErrorReporting: () => true };
