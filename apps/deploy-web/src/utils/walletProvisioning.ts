import { isHttpError } from "@akashnetwork/http-sdk";
import { extractApiErrorCode } from "@akashnetwork/openapi-sdk";

/** Retriable code the API returns for a spend/top-up against a wallet whose trial is still provisioning server-side. */
export const WALLET_PROVISIONING_ERROR_CODE = "wallet_provisioning";
/** Cap on `wallet_provisioning` retries — with the backoff below this spans the couple of minutes the grant tx can take. */
const WALLET_PROVISIONING_RETRY_LIMIT = 15;

/**
 * True for the retriable `wallet_provisioning` 409 from either managed-wallet client: the deployment path throws an
 * openapi-sdk `ApiError` (code read via {@link extractApiErrorCode}), while the Stripe/top-up path throws an http-sdk
 * `AxiosError` carrying the same body at `response.data.code`. Both must match or one flow silently stops retrying.
 */
export function isWalletProvisioning(error: unknown): boolean {
  if (extractApiErrorCode(error) === WALLET_PROVISIONING_ERROR_CODE) return true;
  return isHttpError<{ code?: string }>(error) && error.response?.data?.code === WALLET_PROVISIONING_ERROR_CODE;
}

/**
 * React Query retry options that wait out the server-side trial-activation window: a managed-wallet spend or top-up
 * against a not-yet-provisioned trial gets a retriable `wallet_provisioning` 409, which these retry with backoff until
 * activation lands. Spread into a `useMutation` config so the caller sees a longer-running call, not a terminal failure.
 */
export const walletProvisioningRetry = {
  retry: (failureCount: number, error: unknown) => failureCount < WALLET_PROVISIONING_RETRY_LIMIT && isWalletProvisioning(error),
  retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 10_000)
};
