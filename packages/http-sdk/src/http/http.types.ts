export interface HttpRequestConfig {
  baseURL?: string;
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
  data?: unknown;
  timeout?: number;
  signal?: AbortSignal;
  withCredentials?: boolean;
  responseType?: "json" | "blob" | "text" | "arraybuffer";
  validateStatus?: (status: number) => boolean;
}

export interface HttpResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: HttpRequestConfig;
}

export type HttpAdapter = (config: HttpRequestConfig & { method: string; url: string; headers: Record<string, string> }) => Promise<HttpResponse>;
