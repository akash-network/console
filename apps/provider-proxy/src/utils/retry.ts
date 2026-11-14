import type { LoggerService } from "@akashnetwork/logging";
import { Data, Effect, Schedule } from "effect";

export interface HttpRetryOptions<T> {
  retryIf: (response: T) => boolean;
  maxRetries?: number;
  logger?: LoggerService;
}

class RetriableResponse<T> extends Data.TaggedError("RetriableResponse")<{ readonly response: T }> {}

class CallbackRejected extends Data.TaggedError("CallbackRejected")<{ readonly error: unknown }> {}

const DEFAULT_MAX_RETRIES = 3;
const FIRST_RETRY_DELAY = "200 millis";

export const httpRetry = <T>(callback: () => Promise<T>, options: HttpRetryOptions<T>): Promise<T> => {
  const maxRetries = options.maxRetries || DEFAULT_MAX_RETRIES;
  const callbackName = callback.name || String(callback);
  let attempt = 0;

  const runCallback = Effect.suspend(() => {
    attempt++;
    options.logger?.info({ event: "RUN_CALLBACK", attempt, maxRetries, callback: callbackName });
    return Effect.tryPromise({ try: () => callback(), catch: error => new CallbackRejected({ error }) });
  }).pipe(Effect.filterOrFail(response => !options.retryIf(response), response => new RetriableResponse({ response })));

  const canRetry = (failure: RetriableResponse<T> | CallbackRejected) =>
    attempt <= maxRetries && (failure._tag === "RetriableResponse" || canRetryOnError(failure.error));

  const logRetry = (failure: RetriableResponse<T> | CallbackRejected) =>
    options.logger?.warn({
      event: "RUN_CALLBACK_FAILED",
      attempt,
      maxRetries,
      callback: callbackName,
      error: failure._tag === "RetriableResponse" ? "Callback result requires retry" : failure.error
    });

  return Effect.runPromise(
    runCallback.pipe(
      Effect.tapError(failure => (canRetry(failure) ? Effect.sync(() => logRetry(failure)) : Effect.void)),
      Effect.retry({ schedule: Schedule.exponential(FIRST_RETRY_DELAY), while: canRetry }),
      Effect.catchTag("RetriableResponse", ({ response }) => Effect.succeed(response)),
      Effect.catchTag("CallbackRejected", ({ error }) =>
        Effect.fail(
          attempt > maxRetries
            ? new Error(`Max retries reached: ${maxRetries}`, { cause: error })
            : new Error("Fail to retry due to receiving non-retriable error", { cause: error })
        )
      )
    )
  );
};

const isRetriableError = (code: string) =>
  code === "ECONNREFUSED" || code === "ECONNRESET" || code === "ERR_TLS_SESSION_REJECTED" || code === "ETIMEDOUT" || code === "ESOCKETTIMEDOUT";

export function canRetryOnError(error: unknown): boolean {
  if (!error) return false;

  if (Object.hasOwn(error as Error, "code")) {
    return isRetriableError((error as { code: string }).code);
  }

  return canRetryOnError((error as Error).cause);
}
