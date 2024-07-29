import { HttpService } from "@akashnetwork/http-sdk";
import type { UserProfile } from "@auth0/nextjs-auth0/client";
import { AxiosRequestHeaders } from "axios";

import { ANONYMOUS_USER_KEY } from "@src/utils/constants";

export class AuthHttpService extends HttpService {
  constructor() {
    super();
    this.getProfile = this.getProfile.bind(this);
  }

  async getProfile(url: string) {
    try {
      const user = localStorage.getItem(ANONYMOUS_USER_KEY);
      const anonymousUserId = user ? JSON.parse(user).id : undefined;
      const headers: AxiosRequestHeaders = anonymousUserId ? { "X-ANONYMOUS-USER-ID": anonymousUserId } : {};

      return this.extractData(await this.get<UserProfile | undefined>(url, { headers }));
    } catch (error) {
      console.warn("DEBUG error", error);
      throw error;
    }
  }
}

export const authHttpService = new AuthHttpService();
