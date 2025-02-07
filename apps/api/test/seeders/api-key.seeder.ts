import { faker } from "@faker-js/faker";
import { container } from "tsyringe";

import type { ApiKeyOutput } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";

export class ApiKeySeeder {
  private static apiKeyGenerator = container.resolve(ApiKeyGeneratorService);

  static create({
    id = faker.string.uuid(),
    userId = faker.string.uuid(),
    name = faker.company.name(),
    description = faker.lorem.sentence(),
    expiresAt = null,
    createdAt = new Date().toISOString(),
    updatedAt = new Date().toISOString()
  }: Partial<ApiKeyOutput> = {}): ApiKeyOutput {
    const apiKey = this.apiKeyGenerator.generateApiKey();

    return {
      id,
      userId,
      hashedKey: this.apiKeyGenerator.hashApiKey(apiKey),
      keyFormat: this.apiKeyGenerator.obfuscateApiKey(apiKey),
      name,
      description,
      expiresAt,
      createdAt,
      updatedAt
    };
  }

  static createWithKey({ apiKey = this.apiKeyGenerator.generateApiKey(), ...rest }: Partial<ApiKeyOutput> & { apiKey?: string } = {}): {
    apiKey: string;
    data: ApiKeyOutput;
  } {
    return {
      apiKey,
      data: this.create({
        ...rest,
        hashedKey: this.apiKeyGenerator.hashApiKey(apiKey),
        keyFormat: this.apiKeyGenerator.obfuscateApiKey(apiKey)
      })
    };
  }
}
