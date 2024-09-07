import { HttpService } from "@akashnetwork/http-sdk";
import type { UserProfile } from "@auth0/nextjs-auth0/client";
import { InternalAxiosRequestConfig } from "axios";

import { ANONYMOUS_USER_TOKEN_KEY } from "@src/config/auth.config";

export class UserHttpService extends HttpService {
  constructor() {
    super();
    this.getProfile = this.getProfile.bind(this);
    this.interceptors.request.use((config: InternalAxiosRequestConfig) => {
      const token = localStorage.getItem(ANONYMOUS_USER_TOKEN_KEY);

      if (token) {
        config.headers.set("authorization", `Bearer ${token}`);
      }

      return config;
    });
  }

  async getProfile(url: string) {
    return this.extractData(await this.get<UserProfile | undefined>(url));
  }
}

export const authHttpService = new UserHttpService();
