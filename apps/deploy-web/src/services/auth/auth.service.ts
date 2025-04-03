import type { InternalAxiosRequestConfig } from "axios";

import { ANONYMOUS_USER_TOKEN_KEY } from "@src/config/auth.config";

export class AuthService {
  constructor() {
    this.withAnonymousUserHeader = this.withAnonymousUserHeader.bind(this);
  }

  withAnonymousUserHeader(config: InternalAxiosRequestConfig) {
    const token = localStorage.getItem(ANONYMOUS_USER_TOKEN_KEY);

    if (token) {
      config.headers.set("authorization", `Bearer ${token}`);
    } else {
      config.baseURL = "/api/proxy";
    }

    return config;
  }
}

export const authService = new AuthService();
