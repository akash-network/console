import type { ApiKeyResponse } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";

export const buildApiKey = (overrides: Partial<ApiKeyResponse> = {}): ApiKeyResponse => ({
  id: faker.string.uuid(),
  name: faker.company.name(),
  expiresAt: faker.date.future().toISOString(),
  createdAt: faker.date.past().toISOString(),
  updatedAt: faker.date.recent().toISOString(),
  lastUsedAt: faker.date.recent().toISOString(),
  keyFormat: `ac.sk.test.${faker.string.alphanumeric(15)}`,
  ...overrides
});

export const buildApiKeys = (count: number, overrides: Partial<ApiKeyResponse> = {}): ApiKeyResponse[] =>
  Array.from({ length: count }, () => buildApiKey(overrides));
