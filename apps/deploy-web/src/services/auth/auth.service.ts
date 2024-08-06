import { InternalAxiosRequestConfig } from "axios";

import { ANONYMOUS_USER_KEY } from "@src/utils/constants";

export class AuthService {
  private anonymousUserId: string | undefined;

  constructor() {
    this.withAnonymousUserHeader = this.withAnonymousUserHeader.bind(this);
  }

  withAnonymousUserHeader(config: InternalAxiosRequestConfig) {
    if (!this.anonymousUserId) {
      const user = localStorage.getItem(ANONYMOUS_USER_KEY);
      this.anonymousUserId = user ? JSON.parse(user).id : undefined;
    }

    if (this.anonymousUserId) {
      config.headers.set("x-anonymous-user-id", this.anonymousUserId);
    }

    return config;
  }
}

export const authService = new AuthService();
