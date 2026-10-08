import { faker } from "@faker-js/faker";

import type { AffiliateOutput } from "@src/affiliate/repositories/affiliate/affiliate.repository";

export function createAffiliate({
  id = faker.string.uuid(),
  userId = faker.string.uuid(),
  code = faker.string.alpha({ length: 8, casing: "lower" }),
  approvedAt = faker.date.recent().toISOString(),
  approvedBy = faker.internet.email(),
  revokedAt = null,
  revokedBy = null,
  createdAt = faker.date.recent().toISOString(),
  updatedAt = faker.date.recent().toISOString()
}: Partial<AffiliateOutput> = {}): AffiliateOutput {
  return { id, userId, code, approvedAt, approvedBy, revokedAt, revokedBy, createdAt, updatedAt };
}
