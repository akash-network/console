import assert from "http-assert";
import { singleton } from "tsyringe";

import {
  ApiKeyHiddenResponse,
  ApiKeyVisibleResponse,
  CreateApiKeyRequest,
  ListApiKeysResponse,
  UpdateApiKeyRequest
} from "@src/auth/http-schemas/api-key.schema";
import { ApiKeyService } from "@src/auth/services/api-key/api-key.service";
import { Protected } from "@src/auth/services/auth.service";
import type { AuthMethod } from "@src/core/types/app-context";

@singleton()
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Protected([{ action: "read", subject: "ApiKey" }])
  async findAll(): Promise<ListApiKeysResponse> {
    const apiKeys = await this.apiKeyService.findAll();
    return { data: apiKeys };
  }

  @Protected([{ action: "read", subject: "ApiKey" }])
  async findById(id: string): Promise<ApiKeyHiddenResponse> {
    const apiKey = await this.apiKeyService.findById(id);
    assert(apiKey, 404, "API key not found");
    return { data: apiKey };
  }

  @Protected([{ action: "create", subject: "ApiKey" }])
  async create(input: CreateApiKeyRequest["data"], origin: { authMethod?: AuthMethod }): Promise<ApiKeyVisibleResponse> {
    assert(origin.authMethod === "bearer", 403, "An API key can only be created from a signed-in Console session.", { errorCode: "session_required" });

    const apiKey = await this.apiKeyService.create(input);
    return { data: apiKey };
  }

  @Protected([{ action: "update", subject: "ApiKey" }])
  async update(id: string, input: UpdateApiKeyRequest["data"]): Promise<ApiKeyHiddenResponse> {
    const apiKey = await this.apiKeyService.update(id, input);
    assert(apiKey, 404, "API key not found");
    return { data: apiKey };
  }

  @Protected([{ action: "delete", subject: "ApiKey" }])
  async delete(id: string): Promise<void> {
    await this.apiKeyService.delete(id);
  }
}
