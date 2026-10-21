import type { AxiosAdapter, AxiosInstance, AxiosResponse, CreateAxiosDefaults } from "axios";
import axios from "axios";

import { createFetchAdapter } from "./createFetchAdapter/createFetchAdapter";
import { keepBrowserUserAgent } from "./keepBrowserUserAgent";

export function createHttpClient(fullConfig: HttpClientOptions = {}): HttpClient {
  const { abortPendingWhenOneFail, adapter, ...config } = fullConfig;
  const customAdapter = createFetchAdapter({
    retries: 3,
    adapter: typeof adapter === "function" ? adapter : axios.getAdapter(adapter || "fetch"),
    abortPendingWhenOneFail
  });

  const instance = axios.create({
    ...config,
    adapter: customAdapter,
    headers: {
      "Content-Type": "application/json",
      ...keepBrowserUserAgent(),
      ...config?.headers
    }
  });

  return instance;
}

export type HttpClient = AxiosInstance;
export type HttpClientOptions = Omit<CreateAxiosDefaults, "adapter"> & {
  /** @default 'fetch' */
  adapter?: "fetch" | "xhr" | "http" | AxiosAdapter;
  abortPendingWhenOneFail?: (response: AxiosResponse) => boolean;
};
