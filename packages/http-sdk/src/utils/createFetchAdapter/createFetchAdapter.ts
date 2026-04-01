import type { IBreaker, ICircuitBreakerOptions, IPolicy } from "cockatiel";
import { circuitBreaker, ConsecutiveBreaker, ConstantBackoff, handleAll, handleWhen, IterableBackoff, retry, wrap } from "cockatiel";

import { executeFetch } from "../../http/execute-fetch";
import type { HttpAdapter, HttpRequestConfig, HttpResponse } from "../../http/http.types";
import { HttpError } from "../../http/http-error";

export interface FetchAdapterOptions {
  retries?: number;
  circuitBreaker?: {
    maxAttempts?: number;
    breaker?: IBreaker;
    halfOpenAfter?: ICircuitBreakerOptions["halfOpenAfter"];
  };
  adapter?: HttpAdapter;
  onFailure?: (error: unknown, requestConfig: HttpRequestConfig) => HttpResponse | Promise<HttpResponse> | undefined | null | void;
  onSuccess?: () => void;
  abortPendingWhenOneFail?: (response: HttpResponse) => boolean;
}

const EXTRA_RETRY_AFTER_DELAY = 10 * 1000;
export function createFetchAdapter(options: FetchAdapterOptions = {}): HttpAdapter {
  const handleNetworkOrIdempotentError = handleWhen(error => isNetworkOrIdempotentRequestError(error));
  const policies: IPolicy[] = [];

  if (options.circuitBreaker) {
    // should be first, so we can retry multiple times and then open the circuit breaker
    policies.push(
      circuitBreaker(handleAll, {
        breaker: options.circuitBreaker?.breaker ?? new ConsecutiveBreaker(options.circuitBreaker?.maxAttempts ?? 1),
        halfOpenAfter: options.circuitBreaker?.halfOpenAfter ?? 15 * 1000
      })
    );
  }

  const retryBackoffFallback = new IterableBackoff([100, 500, 1000]);
  const noBackoff = new ConstantBackoff(0);
  policies.push(
    retry(handleNetworkOrIdempotentError, {
      maxAttempts: options.retries ?? 3,
      backoff: {
        next: context => {
          if (!("error" in context.result) || !(context.result.error instanceof HttpError)) return noBackoff.next();

          const retryAfterHeader = context.result.error.response?.headers["retry-after"];
          if (!retryAfterHeader) return retryBackoffFallback.next(context);

          const retryAfterNumber = parseInt(retryAfterHeader, 10);
          if (!Number.isNaN(retryAfterNumber) && retryAfterNumber > 0) return new ConstantBackoff(retryAfterNumber * 1000 + EXTRA_RETRY_AFTER_DELAY).next();

          const retryAfterDate = new Date(retryAfterHeader);
          if (!Number.isNaN(retryAfterDate.getTime()) && retryAfterDate.getTime() > Date.now()) {
            return new ConstantBackoff(retryAfterDate.getTime() - Date.now() + EXTRA_RETRY_AFTER_DELAY).next();
          }

          return retryBackoffFallback.next(context);
        }
      }
    })
  );
  const fetchPolicy = wrap(...policies);

  if (options.onSuccess) {
    fetchPolicy.onSuccess(options.onSuccess);
  }

  const fetchAdapter = options.adapter ?? executeFetch;
  const wrappedAdapter: HttpAdapter = async config => {
    return fetchPolicy
      .execute(() => fetchAdapter(config), config.signal)
      .catch(error => {
        const result = options.onFailure?.(error, config);
        return result ? result : Promise.reject(error);
      });
  };

  return options.abortPendingWhenOneFail ? abortableAdapter(wrappedAdapter, options.abortPendingWhenOneFail) : wrappedAdapter;
}

export function isNetworkOrIdempotentRequestError(error: unknown): boolean {
  if (error instanceof HttpError) return isIdempotentRequestError(error);
  if (error instanceof Error && "code" in error) return isRetriableError(error as ErrorWithCode);
  return false;
}

type ErrorWithCode = Error & { code: unknown };
export function isRetriableError(error: ErrorWithCode): boolean {
  const code = error.code;
  return code === "ECONNREFUSED" || code === "ECONNRESET" || code === "ETIMEDOUT" || code === "ESOCKETTIMEDOUT" || code === "UND_ERR_SOCKET";
}

const IDEMPOTENT_HTTP_METHODS = ["get", "head", "options", "delete", "put"];
function isIdempotentRequestError(error: HttpError): boolean {
  if (!error.config?.method) return false;
  return (
    IDEMPOTENT_HTTP_METHODS.includes(error.config.method.toLowerCase()) &&
    error.code !== "ECONNABORTED" &&
    (!error.response || error.code === "ERR_NETWORK" || error.response.status === 429 || (error.response.status >= 500 && error.response.status < 600))
  );
}

function abortableAdapter(defaultAdapter: HttpAdapter, abortWhen: (response: HttpResponse) => boolean): HttpAdapter {
  let adapterLevelAbortController = new AbortController();
  return async requestConfig => {
    const signal = requestConfig.signal ? AbortSignal.any([requestConfig.signal, adapterLevelAbortController.signal]) : adapterLevelAbortController.signal;

    return defaultAdapter({ ...requestConfig, signal }).catch(error => {
      if (error instanceof HttpError && error.response && abortWhen(error.response)) {
        adapterLevelAbortController.abort();
        adapterLevelAbortController = new AbortController();
      }
      return Promise.reject(error);
    });
  };
}
