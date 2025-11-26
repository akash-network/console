import type { InternalAxiosRequestConfig } from "axios";

export function withUserToken(config: InternalAxiosRequestConfig) {
  config.baseURL = "/api/proxy";
  return config;
}
