import isAfter from "date-fns/isAfter";
import parseISO from "date-fns/parseISO";
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

  async getAndValidateApiKeyFromHeader(apiKey: string | undefined): Promise<ApiKeyOutput | undefined> {
    if (!apiKey) {
      return undefined;
    }

    const [prefix, type, env] = apiKey.split(".");
    if (prefix !== this.API_KEY_PREFIX || type !== this.API_KEY_TYPE || env !== this.DEPLOYMENT_ENV) {
      return undefined;
    }

    const hashedKey = this.apiKeyGenerator.hashApiKey(apiKey);
    const key = await this.apiKeyRepository.findOneBy({ hashedKey });

    if (!key) {
      return undefined;
    }

    if (key.expiresAt) {
      const expirationDate = parseISO(key.expiresAt);
      const now = parseISO(new Date().toISOString());

      if (!isAfter(expirationDate, now)) {
        return undefined;
      }
    }

    return key;
  }
}
