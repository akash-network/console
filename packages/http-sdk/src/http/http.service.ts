import { executeFetch } from "./execute-fetch";
import type { HttpRequestConfig, HttpResponse } from "./http.types";

export class HttpService {
  private readonly baseURL?: string;
  private readonly defaultHeaders: Record<string, string>;
  private readonly defaultTimeout?: number;

  constructor(config?: Pick<HttpRequestConfig, "baseURL" | "headers" | "timeout">) {
    this.baseURL = config?.baseURL;
    this.defaultHeaders = config?.headers ?? {};
    this.defaultTimeout = config?.timeout;
  }

  get<T = unknown>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>> {
    return this.request<T>({ ...config, url, method: "GET" });
  }

  post<T = unknown>(url: string, data?: unknown, config?: HttpRequestConfig): Promise<HttpResponse<T>> {
    return this.request<T>({ ...config, url, method: "POST", data });
  }

  put<T = unknown>(url: string, data?: unknown, config?: HttpRequestConfig): Promise<HttpResponse<T>> {
    return this.request<T>({ ...config, url, method: "PUT", data });
  }

  patch<T = unknown>(url: string, data?: unknown, config?: HttpRequestConfig): Promise<HttpResponse<T>> {
    return this.request<T>({ ...config, url, method: "PATCH", data });
  }

  delete<T = unknown>(url: string, config?: HttpRequestConfig): Promise<HttpResponse<T>> {
    return this.request<T>({ ...config, url, method: "DELETE" });
  }

  getUri(config: { url: string }): string {
    return buildUrl(config.url, this.baseURL);
  }

  protected extractData<T = unknown>(response: HttpResponse<T>): T {
    return extractData(response);
  }

  private async request<T>(config: HttpRequestConfig): Promise<HttpResponse<T>> {
    const baseURL = config.baseURL ?? this.baseURL;
    const headers: Record<string, string> = { ...this.defaultHeaders, ...config.headers };
    const url = buildUrl(config.url ?? "", baseURL, config.params);

    if (config.data !== undefined && typeof config.data !== "string" && config.method !== "GET" && config.method !== "HEAD") {
      headers["Content-Type"] ??= "application/json";
    }

    return executeFetch({
      ...config,
      method: config.method!,
      url,
      headers,
      timeout: config.timeout ?? this.defaultTimeout
    }) as Promise<HttpResponse<T>>;
  }
}

export function extractData<T = unknown>(response: HttpResponse<T>): T {
  return response.data;
}

export function buildUrl(path: string, baseURL?: string, params?: Record<string, unknown>): string {
  let url: string;

  if (baseURL && !path.startsWith("http://") && !path.startsWith("https://")) {
    const base = baseURL.endsWith("/") ? baseURL.slice(0, -1) : baseURL;
    url = path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
  } else {
    url = path;
  }

  if (params) {
    const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null);
    if (entries.length > 0) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of entries) {
        searchParams.set(key, String(value));
      }
      url += (url.includes("?") ? "&" : "?") + searchParams.toString();
    }
  }

  return url;
}
