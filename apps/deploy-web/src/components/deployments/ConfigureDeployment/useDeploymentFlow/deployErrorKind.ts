import { extractApiErrorCode, isApiError } from "@akashnetwork/openapi-sdk";

/** Analytics group deploy failures by these values, so they stay few and keep their names. */
export type DeployErrorKind = "timeout" | "insufficient_funds" | "provider_unreachable" | "chain_error" | "unknown";

const HTTP_PAYMENT_REQUIRED = 402;

const PROVIDER_ERROR_CODES = new Set<string | null>(["provider_unreachable", "manifest_not_delivered"]);

const TIMEOUT_ERROR_CODES = new Set<string | null>(["tx_outcome_unknown", "tx_not_included"]);

/** A gateway that gave up on the api answers without the api's error code, so its status is all there is to go on. */
const TIMEOUT_STATUSES = new Set([408, 504]);

export function deployErrorKindOf(cause: unknown): DeployErrorKind {
  if (!isApiError(cause)) return "unknown";

  const code = extractApiErrorCode(cause);
  if (PROVIDER_ERROR_CODES.has(code)) return "provider_unreachable";
  if (TIMEOUT_ERROR_CODES.has(code) || TIMEOUT_STATUSES.has(cause.status)) return "timeout";
  if (cause.status === HTTP_PAYMENT_REQUIRED) return "insufficient_funds";
  return "chain_error";
}
