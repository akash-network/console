import { ApiHttpService } from "@akashnetwork/http-sdk";
import { AxiosRequestConfig } from "axios";
import memoize from "lodash/memoize";

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
  constructor(config?: AxiosRequestConfig) {
    super(config);
    this.getOrCreateAnonymousUser = memoize(this.getOrCreateAnonymousUser.bind(this));
  }

  async getOrCreateAnonymousUser(id?: string) {
    return await (id ? this.getAnonymousUser(id) : this.createAnonymousUser());
  }

  private async createAnonymousUser() {
    return this.extractApiData(await this.post<UserOutput>("/v1/anonymous-users"));
  }

  private async getAnonymousUser(id: string) {
    try {
      return this.extractApiData(await this.get<UserOutput>(`/v1/anonymous-users/${id}`));
    } catch (error) {
      if (error.response?.status === 404) {
        return this.createAnonymousUser();
      } else {
        throw error;
      }
    }
  }
}
