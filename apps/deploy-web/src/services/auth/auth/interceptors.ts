import type { InternalAxiosRequestConfig } from "axios";

/** Local Next.js route that proxies session-authenticated calls to the console API with the bearer token attached. */
export const PROXY_API_BASE_URL = "/api/proxy";

export function withUserToken(config: InternalAxiosRequestConfig) {
  config.baseURL = PROXY_API_BASE_URL;
  return config;
}
