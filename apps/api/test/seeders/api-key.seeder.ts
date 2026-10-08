import { faker } from "@faker-js/faker";

import type { ApiKeyOutput } from "@src/auth/repositories/api-key/api-key.repository";

export function createApiKey({
  id = faker.string.uuid(),
  userId = faker.string.uuid(),
  organizationId = null,
  projectId = null,
  name = faker.company.name(),
  hashedKey = faker.string.alphanumeric(64),
  keyFormat = `ac.sk.test.${faker.string.alphanumeric(15)}`,
  expiresAt = null,
  createdAt = new Date().toISOString(),
  updatedAt = new Date().toISOString(),
  lastUsedAt = null
}: Partial<ApiKeyOutput> = {}): ApiKeyOutput {
  return {
    id,
    userId,
    organizationId,
    projectId,
    name,
    hashedKey,
    keyFormat,
    expiresAt,
    createdAt,
    updatedAt,
    lastUsedAt
  };
}
