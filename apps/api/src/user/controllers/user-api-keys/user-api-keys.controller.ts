import assert from "http-assert";
import { singleton } from "tsyringe";

import { Protected } from "@src/auth/services/auth.service";
import {
  CreateUserApiKeyRequest,
  ListUserApiKeysResponse,
  SingleUserApiKeyResponse,
  UpdateUserApiKeyRequest
} from "@src/user/http-schemas/user-api-key.schema";
import { UserApiKeyService } from "@src/user/services/user-api-key/user-api-key.service";

@singleton()
export class UserApiKeyController {
  constructor(private readonly userApiKeyService: UserApiKeyService) {}

  @Protected([{ action: "read", subject: "UserApiKey" }])
  async findAll(userId: string): Promise<ListUserApiKeysResponse> {
    const apiKeys = await this.userApiKeyService.findAll(userId);
    return { data: apiKeys };
  }

  @Protected([{ action: "read", subject: "UserApiKey" }])
  async findById(id: string, userId: string): Promise<SingleUserApiKeyResponse> {
    const apiKey = await this.userApiKeyService.findById(id, userId);
    assert(apiKey, 404, "API key not found");
    return { data: apiKey };
  }

  @Protected([{ action: "create", subject: "UserApiKey" }])
  async create(userId: string, input: CreateUserApiKeyRequest["data"]): Promise<SingleUserApiKeyResponse> {
    const apiKey = await this.userApiKeyService.create(userId, input);
    return { data: apiKey };
  }

  @Protected([{ action: "update", subject: "UserApiKey" }])
  async update(id: string, userId: string, input: UpdateUserApiKeyRequest["data"]): Promise<SingleUserApiKeyResponse> {
    const apiKey = await this.userApiKeyService.update(id, userId, input);
    assert(apiKey, 404, "API key not found");
    return { data: apiKey };
  }

  @Protected([{ action: "delete", subject: "UserApiKey" }])
  async delete(id: string, userId: string): Promise<SingleUserApiKeyResponse> {
    const apiKey = await this.userApiKeyService.delete(id, userId);
    assert(apiKey, 404, "API key not found");
    return { data: apiKey };
  }
}
