import type { AxiosRequestConfig } from "axios";

import type { ApiOutput } from "../api-http/api-http.service";
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
  private anonymousUsersPromise: Record<string, Promise<UserCreateResponse | ApiOutput<UserOutput>>> = {};
  private userCreateId = 0;

  constructor(config?: AxiosRequestConfig) {
    super(config);
  }

  getOrCreateAnonymousUser(id?: string): Promise<UserCreateResponse | ApiOutput<UserOutput>> {
    const key = id ?? String(this.userCreateId++);
    if (!this.anonymousUsersPromise[key]) {
      const promise = id ? this.getAnonymousUser(id) : this.createAnonymousUser();
      this.anonymousUsersPromise[key] = promise
        .then(response => {
          if (!id) {
            // do not cache create user response
            delete this.anonymousUsersPromise[key];
          }
          return response;
        })
        .catch(error => {
          delete this.anonymousUsersPromise[key];
          return Promise.reject(error);
        });
    }
    return this.anonymousUsersPromise[key];
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
