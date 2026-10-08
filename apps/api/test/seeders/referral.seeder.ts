import { faker } from "@faker-js/faker";

import type { ReferralOutput } from "@src/affiliate/repositories/referral/referral.repository";

export function createReferral({
  id = faker.string.uuid(),
  referredUserId = faker.string.uuid(),
  affiliateId = faker.string.uuid(),
  trialCreditsCents = null,
  createdAt = faker.date.recent().toISOString()
}: Partial<ReferralOutput> = {}): ReferralOutput {
  return { id, referredUserId, affiliateId, trialCreditsCents, createdAt };
}
