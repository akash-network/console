import { buildUrl } from "../http/http.service";
import type { HttpRequestConfig, HttpResponse } from "../http/http.types";
import { createFetchAdapter } from "./createFetchAdapter/createFetchAdapter";

export interface HttpClient {
  get<T = unknown>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>>;
  post<T = unknown>(url: string, data?: unknown, config?: HttpRequestConfig): Promise<HttpResponse<T>>;
  put<T = unknown>(url: string, data?: unknown, config?: HttpRequestConfig): Promise<HttpResponse<T>>;
  patch<T = unknown>(url: string, data?: unknown, config?: HttpRequestConfig): Promise<HttpResponse<T>>;
  delete<T = unknown>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>>;
  getUri(config: { url: string }): string;
}

export interface HttpClientOptions {
  baseURL?: string;
  headers?: Record<string, string>;
  timeout?: number;
  withCredentials?: boolean;
  abortPendingWhenOneFail?: (response: HttpResponse) => boolean;
}

export function createHttpClient(fullConfig: HttpClientOptions = {}): HttpClient {
  const { abortPendingWhenOneFail, ...config } = fullConfig;
  const resilientAdapter = createFetchAdapter({
    retries: 3,
    abortPendingWhenOneFail
  });

  const baseURL = config.baseURL;
  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...config.headers
  };
  const defaultTimeout = config.timeout;

  function makeRequest<T>(method: string, url: string, data?: unknown, reqConfig?: HttpRequestConfig): Promise<HttpResponse<T>> {
    const resolvedUrl = buildUrl(url, reqConfig?.baseURL ?? baseURL, reqConfig?.params);
    const headers: Record<string, string> = { ...defaultHeaders, ...reqConfig?.headers };

    if (data !== undefined && typeof data !== "string" && method !== "GET" && method !== "HEAD") {
      headers["Content-Type"] ??= "application/json";
    }

    return resilientAdapter({
      ...reqConfig,
      method,
      url: resolvedUrl,
      headers,
      data,
      timeout: reqConfig?.timeout ?? defaultTimeout,
      withCredentials: reqConfig?.withCredentials ?? config.withCredentials
    }) as Promise<HttpResponse<T>>;
  }

  return {
    get: <T = unknown>(url: string, reqConfig?: HttpRequestConfig) => makeRequest<T>("GET", url, undefined, reqConfig),
    post: <T = unknown>(url: string, data?: unknown, reqConfig?: HttpRequestConfig) => makeRequest<T>("POST", url, data, reqConfig),
    put: <T = unknown>(url: string, data?: unknown, reqConfig?: HttpRequestConfig) => makeRequest<T>("PUT", url, data, reqConfig),
    patch: <T = unknown>(url: string, data?: unknown, reqConfig?: HttpRequestConfig) => makeRequest<T>("PATCH", url, data, reqConfig),
    delete: <T = unknown>(url: string, reqConfig?: HttpRequestConfig) => makeRequest<T>("DELETE", url, undefined, reqConfig),
    getUri: (uriConfig: { url: string }) => buildUrl(uriConfig.url, baseURL)
  };
}
