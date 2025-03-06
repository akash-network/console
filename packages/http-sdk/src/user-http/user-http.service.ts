import type { AxiosRequestConfig } from "axios";
import memoize from "lodash/memoize";

import { ApiOutput } from "../api-http/api-http.service";
import { HttpService } from "../http/http.service";
import { isHttpError } from "../utils/isHttpError";

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

export type UserCreateResponse = {
  data: UserOutput;
  token: string;
};

export class UserHttpService extends HttpService {
  constructor(config?: AxiosRequestConfig) {
    super(config);
    this.getOrCreateAnonymousUser = memoize(this.getOrCreateAnonymousUser.bind(this));
  }

  async getOrCreateAnonymousUser(id?: string): Promise<UserCreateResponse | ApiOutput<UserOutput>> {
    return await (id ? this.getAnonymousUser(id) : this.createAnonymousUser());
  }

  private async createAnonymousUser() {
    return this.extractData(await this.post<UserCreateResponse>("/v1/anonymous-users"));
  }

  private async getAnonymousUser(id: string) {
    try {
      return this.extractData(await this.get<ApiOutput<UserOutput>>(`/v1/anonymous-users/${id}`));
    } catch (error) {
      if (isHttpError(error) && error.response?.status === 404) {
        return this.createAnonymousUser();
      } else {
        throw error;
      }
    }
  }
}
