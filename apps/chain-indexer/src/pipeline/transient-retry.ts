import { retryWithBackoff } from "@src/lib/retry-with-backoff/retry-with-backoff";
import { ChainContinuityError } from "@src/pipeline/chain-continuity-error";
import type { LoggerService } from "@src/providers/logging.provider";

const MAX_ATTEMPTS = 10;
const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;

/** Transient failures (RPC timeouts, connection drops) are retried with capped exponential backoff; fatal pipeline errors and an in-progress shutdown propagate immediately. */
export function retryTransient<T>(
  operation: () => Promise<T>,
  options: { isStopped: () => boolean; logger: LoggerService; logContext: { event: string; height?: number } }
): Promise<T> {
  return retryWithBackoff(operation, {
    maxAttempts: MAX_ATTEMPTS,
    baseDelayMs: BASE_DELAY_MS,
    maxDelayMs: MAX_DELAY_MS,
    shouldRethrow: error => options.isStopped() || error instanceof ChainContinuityError,
    onRetry: (error, attempt, delayMs) => options.logger.warn({ ...options.logContext, attempt, delayMs, error })
  });
}
