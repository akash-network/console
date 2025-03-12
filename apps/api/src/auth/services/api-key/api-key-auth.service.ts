import { compare } from "bcryptjs";
import isAfter from "date-fns/isAfter";
import parseISO from "date-fns/parseISO";
import assert from "http-assert";
import { singleton } from "tsyringe";

import { ApiKeyOutput, ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { ApiKeyGeneratorService } from "./api-key-generator.service";

@singleton()
export class ApiKeyAuthService {
  private readonly DEPLOYMENT_ENV = this.config.get("DEPLOYMENT_ENV");
  private readonly API_KEY_PREFIX = "ac";
  private readonly API_KEY_TYPE = "sk";

  constructor(
    private readonly apiKeyGenerator: ApiKeyGeneratorService,
    private readonly apiKeyRepository: ApiKeyRepository,
    private readonly config: CoreConfigService
  ) {}

  private async findMatchingKey(apiKey: string, apiKeys: ApiKeyOutput[]): Promise<ApiKeyOutput | undefined> {
    const comparisons = await Promise.all(apiKeys.map(k => compare(apiKey, k.hashedKey)));
    return apiKeys[comparisons.findIndex(result => result)];
  }

  async getAndValidateApiKeyFromHeader(apiKey: string | undefined): Promise<ApiKeyOutput> {
    assert(apiKey, 401, "Invalid API key");

    const [prefix, type, env] = apiKey.split(".");
    assert(prefix === this.API_KEY_PREFIX && type === this.API_KEY_TYPE && env === this.DEPLOYMENT_ENV, 401, "Invalid API key format");

    const apiKeys = await this.apiKeyRepository.find();
    const key = await this.findMatchingKey(apiKey, apiKeys);

    assert(key && (await this.apiKeyGenerator.validateApiKey(apiKey, key.hashedKey)), 401, "API key not found");

    if (key.expiresAt) {
      const expirationDate = parseISO(key.expiresAt);
      const now = parseISO(new Date().toISOString());

      assert(isAfter(expirationDate, now), 401, "API key has expired");
    }

    return key;
  }
}
