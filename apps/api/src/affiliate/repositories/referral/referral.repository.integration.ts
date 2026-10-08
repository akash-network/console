import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { AffiliateRepository } from "@src/affiliate/repositories/affiliate/affiliate.repository";
import { StripeTransactionRepository } from "@src/billing/repositories";
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

  describe("countByAffiliate", () => {
    it("counts referrals attributed to the affiliate", async () => {
      const { repository, affiliate } = await setup();
      await repository.createIfAbsent({ referredUserId: (await seedUser()).id, affiliateId: affiliate.id });
      await repository.createIfAbsent({ referredUserId: (await seedUser()).id, affiliateId: affiliate.id });

      await expect(repository.countByAffiliate(affiliate.id)).resolves.toBe(2);
    });

    it("excludes referrals attributed to another affiliate", async () => {
      const { repository, affiliate } = await setup();
      const another = await seedAffiliate();
      await repository.createIfAbsent({ referredUserId: (await seedUser()).id, affiliateId: another.id });

      await expect(repository.countByAffiliate(affiliate.id)).resolves.toBe(0);
    });
  });

  describe("countPayingByAffiliate", () => {
    it("counts a referred user with a succeeded card payment", async () => {
      const { repository, affiliate } = await setup();
      const referredUserId = (await seedUser()).id;
      await repository.createIfAbsent({ referredUserId, affiliateId: affiliate.id });
      await seedPayment(referredUserId, "succeeded");

      await expect(repository.countPayingByAffiliate(affiliate.id)).resolves.toBe(1);
    });

    it("counts a referred user with a refunded card payment", async () => {
      const { repository, affiliate } = await setup();
      const referredUserId = (await seedUser()).id;
      await repository.createIfAbsent({ referredUserId, affiliateId: affiliate.id });
      await seedPayment(referredUserId, "refunded");

      await expect(repository.countPayingByAffiliate(affiliate.id)).resolves.toBe(1);
    });

    it("does not count a referred user whose payment never settled", async () => {
      const { repository, affiliate } = await setup();
      const referredUserId = (await seedUser()).id;
      await repository.createIfAbsent({ referredUserId, affiliateId: affiliate.id });
      await seedPayment(referredUserId, "failed");

      await expect(repository.countPayingByAffiliate(affiliate.id)).resolves.toBe(0);
    });

    it("does not count a referred user with no payment at all", async () => {
      const { repository, affiliate } = await setup();
      await repository.createIfAbsent({ referredUserId: (await seedUser()).id, affiliateId: affiliate.id });

      await expect(repository.countPayingByAffiliate(affiliate.id)).resolves.toBe(0);
    });

    it("counts a paying referred user only once even with several settled payments", async () => {
      const { repository, affiliate } = await setup();
      const referredUserId = (await seedUser()).id;
      await repository.createIfAbsent({ referredUserId, affiliateId: affiliate.id });
      await seedPayment(referredUserId, "succeeded");
      await seedPayment(referredUserId, "succeeded");

      await expect(repository.countPayingByAffiliate(affiliate.id)).resolves.toBe(1);
    });
  });

  async function seedPayment(userId: string, status: "succeeded" | "refunded" | "failed") {
    return container.resolve(StripeTransactionRepository).create({
      userId,
      type: "payment_intent",
      status,
      amount: faker.number.int({ min: 1000, max: 100000 }),
      currency: "usd"
    });
  }

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
