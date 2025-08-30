import type { InternalAxiosRequestConfig } from "axios";

import { ANONYMOUS_USER_TOKEN_KEY } from "@src/config/auth.config";

export function withAnonymousUserToken(config: InternalAxiosRequestConfig) {
  const token = typeof localStorage !== "undefined" ? localStorage.getItem(ANONYMOUS_USER_TOKEN_KEY) : null;

  if (token) {
    config.headers.set("authorization", `Bearer ${token}`);
  }

  return config;
}

export function withUserToken(config: InternalAxiosRequestConfig) {
  const token = typeof localStorage !== "undefined" ? localStorage.getItem(ANONYMOUS_USER_TOKEN_KEY) : null;

  if (token) {
    config.headers.set("authorization", `Bearer ${token}`);
  } else {
    config.baseURL = "/api/proxy";
  }

  return config;
}
