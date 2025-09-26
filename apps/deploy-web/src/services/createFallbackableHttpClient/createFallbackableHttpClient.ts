import type { createHttpClient as createDefaultHttpClient, HttpClient } from "@akashnetwork/http-sdk";
import { isHttpError } from "@akashnetwork/http-sdk";
import { ExponentialBackoff, isBrokenCircuitError } from "cockatiel";

import { createFetchAdapter } from "../createFetchAdapter/createFetchAdapter";

export function createFallbackableHttpClient(
  createHttpClient: typeof createDefaultHttpClient,
  fallbackHttpClient: HttpClient,
  options: ChainApiHttpClientOptions
) {
  return createHttpClient({
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
      onFailure: (error, config) => {
        options.onFailure?.(error);

        if (isHttpError(error) || isBrokenCircuitError(error)) {
          return fallbackHttpClient.request(config);
        }
      },
      onSuccess: options.onSuccess
    }),
    "axios-retry": {
      retries: 0
    }
  });
}

export interface ChainApiHttpClientOptions {
  baseURL: string;
  onFailure?: (error: unknown) => void;
  onSuccess?: () => void;
  shouldFallback: () => boolean;
}
