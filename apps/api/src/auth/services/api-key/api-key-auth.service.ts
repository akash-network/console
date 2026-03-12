import { compare } from "bcryptjs";
import isAfter from "date-fns/isAfter";
import parseISO from "date-fns/parseISO";
import assert from "http-assert";
import { singleton } from "tsyringe";

import { ApiKeyOutput, ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { Trace } from "@src/core/services/tracing/tracing.service";
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

  @Trace()
  async getAndValidateApiKeyFromHeader(apiKey: string | undefined): Promise<ApiKeyOutput> {
    assert(apiKey, 401, "Invalid API key");

    const [prefix, type, env] = apiKey.split(".", 3);
    assert(prefix === this.API_KEY_PREFIX && type === this.API_KEY_TYPE && env === this.DEPLOYMENT_ENV, 401, "Invalid API key format");

    const key = await this.findApiKey(apiKey);

    assert(key, 401, "API key not found");

    if (key.expiresAt) {
      const expirationDate = parseISO(key.expiresAt);
      const now = parseISO(new Date().toISOString());

      assert(isAfter(expirationDate, now), 401, "API key has expired");
    }

    return key;
  }

  private async findApiKey(apiKey: string): Promise<ApiKeyOutput | undefined> {
    const sha256Hash = this.apiKeyGenerator.hashApiKeySha256(apiKey);
    const keyBySha256 = await this.apiKeyRepository.findOneBy({ hashedKey: sha256Hash });
    if (keyBySha256) return keyBySha256;

    const key = await this.findMatchingKeyByBcrypt(apiKey);

    if (key) {
      await this.apiKeyRepository.updateHash(key.id, sha256Hash);
    }

    return key;
  }

  private async findMatchingKeyByBcrypt(apiKey: string): Promise<ApiKeyOutput | undefined> {
    const keyFormat = this.apiKeyGenerator.obfuscateApiKey(apiKey);
    const apiKeys = await this.apiKeyRepository.findBcryptKeysByKeyFormat(keyFormat);

    for (const key of apiKeys) {
      if (await compare(apiKey, key.hashedKey)) {
        return key;
      }
    }

    return undefined;
  }
}
