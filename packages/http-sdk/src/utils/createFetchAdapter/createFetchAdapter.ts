import type { AxiosAdapter, AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import axios from "axios";
import type { IBreaker, ICircuitBreakerOptions, IPolicy } from "cockatiel";
import { circuitBreaker, ConsecutiveBreaker, DelegateBackoff, handleAll, handleWhen, retry, wrap } from "cockatiel";

export interface FetchAdapterOptions {
  retries?: number;
  circuitBreaker?: {
    maxAttempts?: number;
    breaker?: IBreaker;
    halfOpenAfter?: ICircuitBreakerOptions["halfOpenAfter"];
  };
  adapter?: AxiosAdapter;
  onFailure?: (error: unknown, requestConfig: InternalAxiosRequestConfig) => AxiosResponse | Promise<AxiosResponse> | undefined | null | void;
  onSuccess?: () => void;
  abortPendingWhenOneFail?: (response: AxiosResponse) => boolean;
}

const EXTRA_RETRY_AFTER_DELAY = 10 * 1000;
export function createFetchAdapter(options: FetchAdapterOptions = {}): AxiosAdapter {
  const handleNetworkOrIdempotentError = handleWhen(error => isNetworkOrIdempotentRequestError(error));
  const policies: IPolicy[] = [];

  if (options.circuitBreaker) {
    // should be first, so we can retry multiple times and then open the circuit breaker
    policies.push(
      circuitBreaker(handleAll, {
        breaker: options.circuitBreaker?.breaker || new ConsecutiveBreaker(options.circuitBreaker?.maxAttempts || 1),
        halfOpenAfter: options.circuitBreaker?.halfOpenAfter || 15 * 1000
      })
    );
  }

  policies.push(
    retry(handleNetworkOrIdempotentError, {
      maxAttempts: options.retries || 3,
      backoff: new DelegateBackoff(context => {
        if (!("error" in context.result) || !axios.isAxiosError(context.result.error)) return 0;

        const retryAfterHeader = context.result.error.response?.headers["retry-after"];
        if (!retryAfterHeader) return 50;

        const retryAfterNumber = parseInt(retryAfterHeader, 10);
        if (!Number.isNaN(retryAfterNumber)) return retryAfterNumber * 1000 + EXTRA_RETRY_AFTER_DELAY;

        const retryAfterDate = new Date(retryAfterHeader);
        if (!Number.isNaN(retryAfterDate.getTime())) {
          return retryAfterDate.getTime() - Date.now() + EXTRA_RETRY_AFTER_DELAY;
        }

        return 0;
      })
    })
  );
  const fetchPolicy = wrap(...policies);

  if (options.onSuccess) {
    fetchPolicy.onSuccess(options.onSuccess);
  }

  const fetchAdapter = options.adapter || axios.getAdapter("fetch");
  const axiosAdapter = async (config: InternalAxiosRequestConfig) => {
    return fetchPolicy
      .execute(() => fetchAdapter(config), config.signal as AbortSignal)
      .catch(error => {
        const result = options.onFailure?.(error, config);
        return result ? result : Promise.reject(error);
      });
  };

  return options.abortPendingWhenOneFail ? abortableAdapter(axiosAdapter, options.abortPendingWhenOneFail) : axiosAdapter;
}

export function isNetworkOrIdempotentRequestError(error: unknown): boolean {
  const isNetworkError = error && !axios.isAxiosError(error) && error instanceof Error && "code" in error && error.code;
  if (isNetworkError) return isRetriableError(error);
  return axios.isAxiosError(error) && isIdempotentRequestError(error);
}

type ErrorWithCode = Error & { code: unknown };
function isRetriableError(error: ErrorWithCode): boolean {
  const code = error.code;
  return code === "ECONNREFUSED" || code === "ECONNRESET" || code === "ETIMEDOUT" || code === "ESOCKETTIMEDOUT";
}

const IDEMPOTENT_HTTP_METHODS = ["get", "head", "options", "delete", "put"];
function isIdempotentRequestError(error: AxiosError): boolean {
  if (!error.config?.method) return false;
  return (
    IDEMPOTENT_HTTP_METHODS.includes(error.config.method.toLowerCase()) &&
    error.code !== "ECONNABORTED" &&
    (!error.response || error.code === "ERR_NETWORK" || error.response.status === 429 || (error.response.status >= 500 && error.response.status < 600))
  );
}

function abortableAdapter(defaultAdapter: AxiosAdapter, abortWhen: (response: AxiosResponse) => boolean): AxiosAdapter {
  let globalAbortController = new AbortController();
  return async (requestConfig: InternalAxiosRequestConfig) => {
    if (requestConfig.signal) {
      requestConfig.signal = AbortSignal.any([requestConfig.signal as AbortSignal, globalAbortController.signal]);
    } else {
      requestConfig.signal = globalAbortController.signal;
    }
    return defaultAdapter(requestConfig).catch(error => {
      if (error.response && abortWhen(error.response)) {
        // abort all requests sent by this adapter
        globalAbortController.abort();
        globalAbortController = new AbortController();
      }
      return Promise.reject(error);
    });
  };
}
