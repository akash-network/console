import { ApiHttpService } from "../api-http/api-http.service";
import { ApiKeyResponse, CreateApiKeyRequest, ListApiKeys } from "./api-key-http.types";

export class ApiKeyHttpService extends ApiHttpService {
  async createApiKey(data: CreateApiKeyRequest) {
    return this.extractApiData(await this.post<ApiKeyResponse>("/api/proxy/v1/api-keys", data, { withCredentials: true }));
  }

  async getApiKeys() {
    return this.extractApiData(await this.get<ListApiKeys>("/api/proxy/v1/api-keys"));
  }

  async deleteApiKey(id: string) {
    return await this.delete(`/api/proxy/v1/api-keys/${id}`, { withCredentials: true });
  }
}
