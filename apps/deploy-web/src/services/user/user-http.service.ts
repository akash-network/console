import { HttpService } from "@akashnetwork/http-sdk";
import type { UserProfile } from "@auth0/nextjs-auth0/client";

import { authService } from "@src/services/auth/auth.service";

export class UserHttpService extends HttpService {
  constructor() {
    super();
    this.getProfile = this.getProfile.bind(this);
    this.interceptors.request.use(authService.withAnonymousUserHeader);
  }

  async getProfile(url: string) {
    return this.extractData(await this.get<UserProfile | undefined>(url));
  }
}

export const authHttpService = new UserHttpService();
