export interface RetryWithBackoffOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs?: number;
  /** Errors for which a retry cannot help (fatal conditions, shutdown in progress); they propagate immediately. */
  shouldRethrow?: (error: unknown) => boolean;
  onRetry: (error: unknown, attempt: number, delayMs: number) => void;
}

export async function retryWithBackoff<T>(operation: () => Promise<T>, options: RetryWithBackoffOptions): Promise<T> {
  let attempt = 0;

  while (true) {
    attempt++;
    try {
      return await operation();
    } catch (error) {
      if (options.shouldRethrow?.(error) || attempt >= options.maxAttempts) {
        throw error;
      }

      const uncappedDelayMs = options.baseDelayMs * 2 ** (attempt - 1);
      const delayMs = options.maxDelayMs === undefined ? uncappedDelayMs : Math.min(uncappedDelayMs, options.maxDelayMs);
      options.onRetry(error, attempt, delayMs);
      await delay(delayMs);
    }
  }
}

/** Global setTimeout rather than node:timers/promises so tests can advance the backoff with vitest fake timers, which do not intercept node:timers/promises. */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}
