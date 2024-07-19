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
  private static userAsPromised: Promise<UserOutput>;

  async getOrCreateAnonymousUser(id?: string) {
    UserHttpService.userAsPromised = UserHttpService.userAsPromised || (id ? this.getAnonymousUser(id) : this.createAnonymousUser());
    return await UserHttpService.userAsPromised;
  }

  async createAnonymousUser() {
    return this.extractData(await this.post<UserOutput>("/v1/anonymous-users"));
  }

  async getAnonymousUser(id: string) {
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
