import { InternalAxiosRequestConfig } from "axios";

import { ANONYMOUS_USER_KEY } from "@src/utils/constants";

export class AuthService {
  constructor() {
    this.withAnonymousUserHeader = this.withAnonymousUserHeader.bind(this);
  }

  withAnonymousUserHeader(config: InternalAxiosRequestConfig) {
    const user = localStorage.getItem(ANONYMOUS_USER_KEY);
    const anonymousUserId = user ? JSON.parse(user).id : undefined;

    if (anonymousUserId) {
      config.headers.set("x-anonymous-user-id", anonymousUserId);
    } else {
      config.baseURL = "/api/proxy";
    }

    return config;
  }
}

export const authService = new AuthService();
