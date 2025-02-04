import assert from "http-assert";
import { singleton } from "tsyringe";

import { Protected } from "@src/auth/services/auth.service";
import { CreateUserApiKeyRequest, UpdateUserApiKeyRequest, UserApiKeyResponse } from "@src/user/http-schemas/user-api-key.schema";
import { UserApiKeyService } from "@src/user/services/user-api-key/user-api-key.service";

@singleton()
export class UserApiKeyController {
  constructor(private readonly userApiKeyService: UserApiKeyService) {}

  @Protected([{ action: "read", subject: "UserApiKey" }])
  async findAll(): Promise<UserApiKeyResponse[]> {
    const apiKeys = await this.userApiKeyService.findAll();
    return apiKeys.map(key => ({ data: key }));
  }

  @Protected([{ action: "read", subject: "UserApiKey" }])
  async findById(id: string): Promise<UserApiKeyResponse> {
    const apiKey = await this.userApiKeyService.findById(id);
    assert(apiKey, 404, "API key not found");
    return { data: apiKey };
  }

  @Protected([{ action: "create", subject: "UserApiKey" }])
  async create(userId: string, input: CreateUserApiKeyRequest["data"]): Promise<UserApiKeyResponse> {
    const apiKey = await this.userApiKeyService.create(userId, input);
    return { data: apiKey };
  }

  @Protected([{ action: "update", subject: "UserApiKey" }])
  async update(id: string, input: UpdateUserApiKeyRequest["data"]): Promise<UserApiKeyResponse> {
    const apiKey = await this.userApiKeyService.update(id, input);
    assert(apiKey, 404, "API key not found");
    return { data: apiKey };
  }

  @Protected([{ action: "delete", subject: "UserApiKey" }])
  async delete(id: string): Promise<UserApiKeyResponse> {
    const apiKey = await this.userApiKeyService.delete(id);
    assert(apiKey, 404, "API key not found");
    return { data: apiKey };
  }
}
