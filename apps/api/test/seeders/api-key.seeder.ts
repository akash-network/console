import { faker } from "@faker-js/faker";

import type { ApiKeyOutput } from "@src/auth/repositories/api-key/api-key.repository";

export class ApiKeySeeder {
  static create({
    id = faker.string.uuid(),
    userId = faker.string.uuid(),
    name = faker.company.name(),
    description = faker.lorem.sentence(),
    hashedKey = faker.string.alphanumeric(64),
    keyFormat = `ac.sk.test.${faker.string.alphanumeric(15)}`,
    expiresAt = null,
    createdAt = new Date().toISOString(),
    updatedAt = new Date().toISOString()
  }: Partial<ApiKeyOutput> = {}): ApiKeyOutput {
    return {
      id,
      userId,
      name,
      description,
      hashedKey,
      keyFormat,
      expiresAt,
      createdAt,
      updatedAt
    };
  }
}
