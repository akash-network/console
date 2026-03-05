import { type createHttpClient as createDefaultHttpClient, type HttpClient } from "@akashnetwork/http-sdk";
import { createFetchAdapter, isNetworkOrIdempotentRequestError } from "@akashnetwork/http-sdk";
import { ExponentialBackoff, isBrokenCircuitError } from "cockatiel";

export type FallbackableHttpClient = HttpClient & { isFallbackEnabled: boolean };
export function createFallbackableHttpClient(
  createHttpClient: typeof createDefaultHttpClient,
  fallbackHttpClient: HttpClient,
  options: ChainApiHttpClientOptions
): FallbackableHttpClient {
  const httpClient = createHttpClient({
    baseURL: options.baseURL,
    adapter: createFetchAdapter({
      circuitBreaker: {
        halfOpenAfter: new ExponentialBackoff({
          maxDelay: 5 * 60 * 1000
        }),
        breaker: {
          state: null,
          success() {},
          failure: options.shouldFallback
        }
      },
      onFailure: (error, requestConfig) => {
        if (isNetworkOrIdempotentRequestError(error) || isBrokenCircuitError(error)) {
          return Promise.resolve(options.onUnavailableError?.(error)).then(() => {
            const { adapter, ...restOfRequestConfig } = requestConfig;
            return fallbackHttpClient.request(restOfRequestConfig);
          });
        }
      },
      onSuccess: options.onSuccess
    })
  });

  Object.defineProperty(httpClient, "isFallbackEnabled", {
    get: options.shouldFallback
  });

  return httpClient as FallbackableHttpClient;
}

export interface ChainApiHttpClientOptions {
  baseURL: string;
  onUnavailableError?: (error: unknown) => void | Promise<void>;
  onSuccess?: () => void;
  shouldFallback: () => boolean;
}
