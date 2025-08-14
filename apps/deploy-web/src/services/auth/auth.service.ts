import type { InternalAxiosRequestConfig } from "axios";

import { ANONYMOUS_USER_TOKEN_KEY } from "@src/config/auth.config";
import { ONBOARDING_STEP_KEY } from "../storage/keys";

export class AuthService {
  constructor(private readonly urlService: LogoutUrlService) {
    this.withAnonymousUserHeader = this.withAnonymousUserHeader.bind(this);
  }

  withAnonymousUserHeader(config: InternalAxiosRequestConfig) {
    const token = typeof localStorage !== "undefined" ? localStorage.getItem(ANONYMOUS_USER_TOKEN_KEY) : null;

    if (token) {
      config.headers.set("authorization", `Bearer ${token}`);
    } else {
      config.baseURL = "/api/proxy";
    }

    return config;
  }

  logout() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(ANONYMOUS_USER_TOKEN_KEY);
    window.localStorage.removeItem(ONBOARDING_STEP_KEY);
    window.location.href = this.urlService.logout();
  }
}

interface LogoutUrlService {
  logout(): string;
}
