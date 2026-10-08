import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { AffiliateRepository } from "@src/affiliate/repositories/affiliate/affiliate.repository";
import { ReferralRepository } from "./referral.repository";

import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

describe(ReferralRepository.name, () => {
  describe("createIfAbsent", () => {
    it("creates a referral row for a first-time referred user", async () => {
      const { repository, referredUserId, affiliate } = await setup();

      const referral = await repository.createIfAbsent({ referredUserId, affiliateId: affiliate.id });

      expect(referral).toMatchObject({ referredUserId, affiliateId: affiliate.id });
    });

    it("does nothing and returns undefined for a user who was already referred", async () => {
      const { repository, referredUserId, affiliate } = await setup();
      const another = await seedAffiliate();
      await repository.createIfAbsent({ referredUserId, affiliateId: affiliate.id });

      const result = await repository.createIfAbsent({ referredUserId, affiliateId: another.id });

      expect(result).toBeUndefined();
      expect(await repository.findByReferredUserId(referredUserId)).toMatchObject({ affiliateId: affiliate.id });
    });
  });

  describe("findByReferredUserId", () => {
    it("returns undefined when the user was never referred", async () => {
      const { repository, referredUserId } = await setup();

      await expect(repository.findByReferredUserId(referredUserId)).resolves.toBeUndefined();
    });
  });

  describe("findWithAffiliateByReferredUserId", () => {
    it("returns the referral alongside the affiliate it is attributed to", async () => {
      const { repository, referredUserId, affiliate } = await setup();
      await repository.createIfAbsent({ referredUserId, affiliateId: affiliate.id });

      const result = await repository.findWithAffiliateByReferredUserId(referredUserId);

      expect(result).toMatchObject({
        referral: { referredUserId, affiliateId: affiliate.id },
        affiliate: { id: affiliate.id, code: affiliate.code }
      });
    });

    it("returns undefined when the user was never referred", async () => {
      const { repository, referredUserId } = await setup();

      await expect(repository.findWithAffiliateByReferredUserId(referredUserId)).resolves.toBeUndefined();
    });
  });

  async function seedAffiliate() {
    const owner = await seedUser();
    return container.resolve(AffiliateRepository).create({
      userId: owner.id,
      code: faker.string.alpha({ length: 8, casing: "lower" }),
      approvedAt: new Date(),
      approvedBy: "ops@akash.network"
    });
  }

  async function setup() {
    const referred = await seedUser();
    const affiliate = await seedAffiliate();

    return { repository: container.resolve(ReferralRepository), referredUserId: referred.id, affiliate };
  }
});
