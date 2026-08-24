import { isHttpError } from "@akashnetwork/http-sdk";

const MAX_SERVER_ERROR_RETRIES = 3;

/** The provider proxy answers 502 when it cannot reach the provider host and 503 when the provider itself failed. */
const PROVIDER_UNAVAILABLE_STATUSES = [502, 503];

/** Server errors are usually transient, so they get a few attempts. Everything else fails on the first try. */
export function retryOnServerError(failureCount: number, error: unknown): boolean {
  return isHttpError(error) && !!error.response && error.response.status >= 500 && failureCount < MAX_SERVER_ERROR_RETRIES;
}

/**
 * Whether a request failed because the provider behind the proxy is down rather than because Console is.
 * Only meaningful for calls that go through the provider proxy, since it owns these two statuses.
 */
export function isProviderUnavailableError(error: unknown): boolean {
  return isHttpError(error) && !!error.response && PROVIDER_UNAVAILABLE_STATUSES.includes(error.response.status);
}

/**
 * Queries opt out of error reporting by putting a predicate on React Query's `meta`, which is the documented
 * way to hand per-query policy to the global cache handler.
 */
export function shouldReportQueryError(error: unknown, meta: Record<string, unknown> | undefined): boolean {
  const skipErrorReporting = meta?.skipErrorReporting;
  return typeof skipErrorReporting === "function" ? !skipErrorReporting(error) : true;
}

export const SKIP_REPORTING_PROVIDER_UNAVAILABLE = { skipErrorReporting: isProviderUnavailableError };
