import isAfter from "date-fns/isAfter";
import parseISO from "date-fns/parseISO";
import { singleton } from "tsyringe";

import { ApiKeyOutput, ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "./api-key-generator.service";

@singleton()
export class ApiKeyAuthService {
  constructor(
    private readonly apiKeyGenerator: ApiKeyGeneratorService,
    private readonly apiKeyRepository: ApiKeyRepository
  ) {}

  async validateApiKeyFromHeader(apiKey: string | undefined): Promise<ApiKeyOutput | undefined> {
    if (!apiKey) {
      return undefined;
    }

    const [prefix, type, env] = apiKey.split(".");
    if (prefix !== "ac" || type !== "sk" || env !== (process.env.NODE_ENV === "production" ? "live" : "test")) {
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
