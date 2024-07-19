import { ApiUserOutput } from "@src/queries/useAnonymousUserQuery";
import { ApiHttpService } from "@src/services/api-http/api-http.service";

export class UserHttpService extends ApiHttpService {
  private static userAsPromised: Promise<ApiUserOutput>;

  async getOrCreateAnonymousUser(id?: string) {
    UserHttpService.userAsPromised = UserHttpService.userAsPromised || (id ? this.getAnonymousUser(id) : this.createAnonymousUser());
    return await UserHttpService.userAsPromised;
  }

  async createAnonymousUser() {
    return this.extractData(await this.post<ApiUserOutput>("/v1/anonymous-users"));
  }

  async getAnonymousUser(id: string) {
    try {
      return this.extractData(await this.get<ApiUserOutput>(`/v1/anonymous-users/${id}`));
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
