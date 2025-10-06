import type { createHttpClient as createDefaultHttpClient, HttpClient } from "@akashnetwork/http-sdk";
import { ExponentialBackoff, isBrokenCircuitError } from "cockatiel";

import { createFetchAdapter, isNetworkOrIdempotentRequestError } from "../createFetchAdapter/createFetchAdapter";

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
          maxDelay: 10 * 60 * 1000
        }),
        breaker: {
          state: null,
          success() {},
          failure: options.shouldFallback
        }
      },
      onFailure: (error, requestConfig) => {
        if (isNetworkOrIdempotentRequestError(error) || isBrokenCircuitError(error)) {
          options.onUnavailableError?.(error);
          const { adapter, ...restOfRequestConfig } = requestConfig;
          return fallbackHttpClient.request(restOfRequestConfig);
        }
      },
      onSuccess: options.onSuccess
    }),
    "axios-retry": {
      retries: 0
    }
  });

  Object.defineProperty(httpClient, "isFallbackEnabled", {
    get: options.shouldFallback
  });

  return httpClient as FallbackableHttpClient;
}

export interface ChainApiHttpClientOptions {
  baseURL: string;
  onUnavailableError?: (error: unknown) => void;
  onSuccess?: () => void;
  shouldFallback: () => boolean;
}
