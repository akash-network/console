import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { AffiliateRepository } from "@src/affiliate/repositories/affiliate/affiliate.repository";
import { StripeTransactionRepository } from "@src/billing/repositories";
import { ReferralRepository } from "./referral.repository";

import { seedOrganization, seedOrganizationMember } from "@test/seeders/db/organization.seeder";
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

    it("counts a referred user whose payment was filed under their personal organization", async () => {
      const { repository, affiliate } = await setup();
      const referredUserId = (await seedUser()).id;
      await repository.createIfAbsent({ referredUserId, affiliateId: affiliate.id });
      const personalOrganization = await seedOrganization({ type: "personal", createdByUserId: referredUserId });
      await seedPayment(referredUserId, "succeeded", { organizationId: personalOrganization.id });

      await expect(repository.countPayingByAffiliate(affiliate.id)).resolves.toBe(1);
    });

    it("counts a referred user whose team another member paid for", async () => {
      const { repository, affiliate } = await setup();
      const referredUserId = (await seedUser()).id;
      await repository.createIfAbsent({ referredUserId, affiliateId: affiliate.id });
      const team = await seedOrganization({ type: "team", createdByUserId: referredUserId });
      await seedPayment((await seedUser()).id, "succeeded", { organizationId: team.id });

      await expect(repository.countPayingByAffiliate(affiliate.id)).resolves.toBe(1);
    });

    it("does not count a referred user who only paid for a team someone else created", async () => {
      const { repository, affiliate } = await setup();
      const referredUserId = (await seedUser()).id;
      await repository.createIfAbsent({ referredUserId, affiliateId: affiliate.id });
      const team = await seedOrganization({ type: "team", createdByUserId: (await seedUser()).id });
      await seedOrganizationMember({ organizationId: team.id, userId: referredUserId });
      await seedPayment(referredUserId, "succeeded", { organizationId: team.id });

      await expect(repository.countPayingByAffiliate(affiliate.id)).resolves.toBe(0);
    });
  });

  async function seedPayment(userId: string, status: "succeeded" | "refunded" | "failed", options: { organizationId?: string } = {}) {
    return container.resolve(StripeTransactionRepository).create({
      userId,
      organizationId: options.organizationId,
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
