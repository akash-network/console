import type { AxiosInstance, CreateAxiosDefaults } from "axios";
import axios from "axios";
import axiosRetry from "axios-retry";

export function createHttpClient(config: HttpClientOptions = {}): HttpClient {
  const instance = axios.create({
    ...config,
    headers: {
      "Content-Type": "application/json",
      ...config?.headers
    }
  });

  axiosRetry(instance, {
    retries: 3,
    retryDelay: axiosRetry.exponentialDelay,
    retryCondition: axiosRetry.isNetworkOrIdempotentRequestError
  });

  return instance;
}

export type HttpClient = AxiosInstance;
export type HttpClientOptions = CreateAxiosDefaults;
