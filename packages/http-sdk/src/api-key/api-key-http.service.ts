import { ApiHttpService } from "../api-http/api-http.service";
import type { ApiKeyResponse, CreateApiKeyRequest, ListApiKeys } from "./api-key-http.types";

export class ApiKeyHttpService extends ApiHttpService {
  async createApiKey(data: CreateApiKeyRequest) {
    return this.extractApiData(await this.post<ApiKeyResponse>("/v1/api-keys", data, { withCredentials: true }));
  }

  async getApiKeys() {
    return this.extractApiData(await this.get<ListApiKeys>("/v1/api-keys"));
  }

  async deleteApiKey(id: string) {
    return await this.delete(`/v1/api-keys/${id}`, { withCredentials: true });
  }
}
