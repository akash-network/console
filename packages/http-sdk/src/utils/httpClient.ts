import type { AxiosInstance, AxiosResponse, CreateAxiosDefaults } from "axios";
import axios from "axios";

import { createFetchAdapter } from "./createFetchAdapter/createFetchAdapter";

export function createHttpClient(fullConfig: HttpClientOptions = {}): HttpClient {
  const { abortPendingWhenOneFail, ...config } = fullConfig;
  const adapter = createFetchAdapter({
    retries: 3,
    abortPendingWhenOneFail
  });

  const instance = axios.create({
    adapter,
    ...config,
    headers: {
      "Content-Type": "application/json",
      ...config?.headers
    }
  });

  return instance;
}

export type HttpClient = AxiosInstance;
export type HttpClientOptions = CreateAxiosDefaults & { abortPendingWhenOneFail?: (response: AxiosResponse) => boolean };
