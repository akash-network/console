import { faker } from "@faker-js/faker";

import type { DataKeyOutput } from "@src/secret/repositories/data-key/data-key.repository";

export function createDataKey({
  id = faker.string.uuid(),
  userId = faker.string.uuid(),
  wrappedKey = `wrapped-${faker.string.alphanumeric(64)}`,
  wrappedByKid = "sdl-secrets.v1",
  createdAt = faker.date.recent(),
  updatedAt = faker.date.recent()
}: Partial<DataKeyOutput> = {}): DataKeyOutput {
  return { id, userId, wrappedKey, wrappedByKid, createdAt, updatedAt };
}
