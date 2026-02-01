import { isRetriableError } from "@akashnetwork/http-sdk";
import { ExponentialBackoff, handleWhen, retry } from "cockatiel";

/**
 * Extracts error message from various error types.
 */
function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

/**
 * Pattern matchers for account sequence mismatch errors.
 * These occur when multiple transactions are sent from the same account
 * before the previous one is confirmed.
 */
const SEQUENCE_MISMATCH_PATTERNS = [/account sequence mismatch/i, /incorrect account sequence/i, /expected sequence/i];

/**
 * Checks if an error is an account sequence mismatch error.
 * These errors occur when broadcasting transactions from shared signers
 * and the account sequence is out of sync.
 *
 * @param err - The error to check.
 * @returns true if the error is an account sequence mismatch.
 *
 * @example
 * try {
 *   await signingClient.sendTokens(...);
 * } catch (err) {
 *   if (isAccountSequenceMismatch(err)) {
 *     // Can retry with updated sequence
 *   }
 * }
 */
export function isAccountSequenceMismatch(err: unknown): boolean {
  const message = getErrorMessage(err);
  const isMatch = SEQUENCE_MISMATCH_PATTERNS.some(pattern => pattern.test(message));

  return isMatch;
}

/**
 * Pattern matchers for transient faucet errors that should be retried.
 * Includes rate limiting, timeouts, and network errors.
 */
const FAUCET_TRANSIENT_PATTERNS = [
  // HTTP rate limiting
  /429/,
  /rate limit/i,
  /too many requests/i,

  // Timeouts
  /timeout/i,
  /ETIMEDOUT/,
  /timed out/i,

  // Connection errors
  /ECONNRESET/,
  /ECONNREFUSED/,
  /ENOTFOUND/,
  /EAI_AGAIN/,
  /socket hang up/i,

  // Temporary/transient errors
  /tempor/i, // temporary, temporarily
  /unavailable/i,
  /service unavailable/i,
  /try again/i,

  // Network errors
  /network/i,
  /fetch failed/i,
  /EPIPE/,
  /ECONNABORTED/
];

/**
 * Checks if an error is a transient faucet error that should be retried.
 * Includes rate limiting (429), timeouts, and network errors.
 *
 * @param err - The error to check.
 * @returns true if the error is transient and should be retried.
 *
 * @example
 * try {
 *   await fetch(faucetUrl, { ... });
 * } catch (err) {
 *   if (isFaucetTransient(err)) {
 *     // Safe to retry
 *   }
 * }
 */
export function isFaucetTransient(err: unknown): boolean {
  if (err && err instanceof Error && (isRetriableError(err as Error & { code: unknown }) || (err.cause && isFaucetTransient(err.cause)))) {
    return true;
  }

  const message = getErrorMessage(err);
  const isMatch = FAUCET_TRANSIENT_PATTERNS.some(pattern => pattern.test(message));

  return isMatch;
}

/**
 * Retry policy for faucet operations.
 *
 * Configuration:
 * - Max attempts: 8
 * - Initial delay: 250ms
 * - Max delay: 3000ms (3 seconds)
 * - Backoff: Exponential with randomization
 *
 * Handles:
 * - Rate limiting (429)
 * - Timeouts
 * - Connection errors (ECONNRESET, ECONNREFUSED, etc.)
 * - Temporary unavailability
 *
 * @example
 * const result = await faucetRetryPolicy.execute(async () => {
 *   const response = await fetch(faucetUrl, {
 *     method: "POST",
 *     body: `address=${encodeURIComponent(address)}`
 *   });
 *   if (!response.ok) {
 *     throw new Error(`Faucet error: ${response.status}`);
 *   }
 *   return response;
 * });
 */
export const faucetRetryPolicy = retry(
  handleWhen(error => isFaucetTransient(error) || isAccountSequenceMismatch(error)),
  {
    maxAttempts: 8,
    backoff: new ExponentialBackoff({
      initialDelay: 250,
      maxDelay: 3000
    })
  }
);

/**
 * Retry policy for waiting for balance updates after faucet topup.
 * Uses shorter delays and more attempts since we're just polling.
 *
 * Configuration:
 * - Max attempts: 15
 * - Initial delay: 500ms
 * - Max delay: 2000ms (2 seconds)
 *
 * @example
 * await balanceWaitPolicy.execute(async () => {
 *   const balance = await getBalance(address, denom);
 *   if (BigInt(balance.amount) < BigInt(minAmount)) {
 *     throw new Error("Balance not yet updated");
 *   }
 *   return balance;
 * });
 */
export const balanceWaitPolicy = retry(
  handleWhen(() => true),
  {
    maxAttempts: 15,
    backoff: new ExponentialBackoff({
      initialDelay: 500,
      maxDelay: 2000
    })
  }
);
