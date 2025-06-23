import { setTimeout } from "timers/promises";

export const httpRetry = <T>(callback: () => Promise<T>, options: HttpRetryOptions<T>): Promise<T> => {
  return retryWithBackoff(callback, options.retryIf, options.maxRetries || 3, 0);
};

export interface HttpRetryOptions<T> {
  retryIf: (response: T) => boolean;
  maxRetries?: number;
}

async function retryWithBackoff<T>(
  callback: () => Promise<T>,
  shouldRetryOnResponse: HttpRetryOptions<T>["retryIf"],
  maxRetries: number,
  attempt: number
): Promise<T> {
  try {
    if (attempt > 0) {
      // (2 ** 1) * 100 = 200 ms
      // (2 ** 2) * 100 = 400 ms
      // (2 ** 3) * 100 = 800 ms
      // (2 ** 4) * 100 = 1600 ms
      // (2 ** 5) * 100 = 3200 ms
      await setTimeout(2 ** attempt * 100);
    }
    const response = await callback();

    if (attempt < maxRetries && shouldRetryOnResponse(response)) {
      return retryWithBackoff(callback, shouldRetryOnResponse, maxRetries, attempt + 1);
    }
    return response;
  } catch (error: unknown) {
    if (attempt < maxRetries && canRetryOnError(error)) {
      return retryWithBackoff(callback, shouldRetryOnResponse, maxRetries, attempt + 1);
    }

    if (attempt >= maxRetries) {
      throw new Error(`Max retries reached: ${maxRetries}`, { cause: error });
    }

    throw new Error("Fail to retry due to receiving non-retriable error", { cause: error });
  }
}

const isRetriableError = (code: string) =>
  code === "ECONNREFUSED" || code === "ECONNRESET" || code === "ERR_TLS_SESSION_REJECTED" || code === "ETIMEDOUT" || code === "ESOCKETTIMEDOUT";

export function canRetryOnError(error: unknown): boolean {
  if (!error) return false;

  if (Object.hasOwn(error as Error, "code")) {
    return isRetriableError((error as { code: string }).code);
  }

  return canRetryOnError((error as Error).cause);
}
