import memoize from "lodash/memoize";

import { ApiHttpService } from "@src/services/api-http/api-http.service";

export interface UserOutput {
  id: string;
  userId?: string;
  username?: string;
  email?: string;
  emailVerified: boolean;
  stripeCustomerId?: string;
  bio?: string;
  subscribedToNewsletter: boolean;
  youtubeUsername?: string;
  twitterUsername?: string;
  githubUsername?: string;
}

export class UserHttpService extends ApiHttpService {
  constructor() {
    super();
    this.getOrCreateAnonymousUser = memoize(this.getOrCreateAnonymousUser.bind(this));
  }

  async getOrCreateAnonymousUser(id?: string) {
    return await (id ? this.getAnonymousUser(id) : this.createAnonymousUser());
  }

  private async createAnonymousUser() {
    return this.extractData(await this.post<UserOutput>("/v1/anonymous-users"));
  }

  private async getAnonymousUser(id: string) {
    try {
      return this.extractData(await this.get<UserOutput>(`/v1/anonymous-users/${id}`));
    } catch (error) {
      if (error.response?.status === 404) {
        return this.createAnonymousUser();
      } else {
        throw error;
      }
    }
  }
}

export const userHttpService = new UserHttpService();
