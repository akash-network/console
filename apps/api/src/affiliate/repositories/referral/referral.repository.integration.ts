import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { AffiliateRepository } from "@src/affiliate/repositories/affiliate/affiliate.repository";
import { StripeTransactionRepository } from "@src/billing/repositories";
import { type ApiPgDatabase, POSTGRES_DB, resolveTable } from "@src/core";
import { ReferralRepository } from "./referral.repository";

import { seedOrganization, seedOrganizationMember } from "@test/seeders/db/organization.seeder";
import { seedUser, seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";

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

  describe("findSummariesByAffiliate", () => {
    it("lists the affiliate's referrals newest first, one page at a time", async () => {
      const { repository, affiliate } = await setup();
      const oldest = await referUser(affiliate.id, new Date("2024-01-01T00:00:00Z"));
      const middle = await referUser(affiliate.id, new Date("2024-02-01T00:00:00Z"));
      const newest = await referUser(affiliate.id, new Date("2024-03-01T00:00:00Z"));
      await referUser((await seedAffiliate()).id, new Date("2024-04-01T00:00:00Z"));

      const firstPage = await repository.findSummariesByAffiliate({ affiliateId: affiliate.id, affiliateUserId: affiliate.userId }, { limit: 2, offset: 0 });
      const secondPage = await repository.findSummariesByAffiliate({ affiliateId: affiliate.id, affiliateUserId: affiliate.userId }, { limit: 2, offset: 2 });

      expect(firstPage.map(summary => summary.id)).toEqual([newest.id, middle.id]);
      expect(secondPage.map(summary => summary.id)).toEqual([oldest.id]);
      expect(firstPage[0].createdAt).toEqual(new Date("2024-03-01T00:00:00Z"));
    });

    it("sums what the referral paid by card net of refunds, teams they created included, and leaves out other payments", async () => {
      const { repository, affiliate } = await setup();
      const referral = await referUser(affiliate.id);
      const team = await seedOrganization({ type: "team", createdByUserId: referral.referredUserId });
      const joinedTeam = await seedOrganization({ type: "team", createdByUserId: (await seedUser()).id });
      await seedPayment(referral.referredUserId, "succeeded", { amount: 10000 });
      await seedPayment(referral.referredUserId, "refunded", { amount: 5000, amountRefunded: 2000 });
      await seedPayment((await seedUser()).id, "succeeded", { amount: 4000, organizationId: team.id });
      await seedPayment(referral.referredUserId, "failed", { amount: 7000 });
      await seedPayment(referral.referredUserId, "succeeded", { amount: 9000, organizationId: joinedTeam.id });

      const [summary] = await repository.findSummariesByAffiliate({ affiliateId: affiliate.id, affiliateUserId: affiliate.userId }, { limit: 20, offset: 0 });

      expect(summary).toMatchObject({ hasPaid: true, paidCents: 17000 });
    });

    it("sums the affiliate's held and credited commission on the referral's payments, net of what was taken back", async () => {
      const { repository, affiliate } = await setup();
      const referral = await referUser(affiliate.id);
      const team = await seedOrganization({ type: "team", createdByUserId: referral.referredUserId });
      const payment = await seedPayment(referral.referredUserId, "succeeded", { amount: 10000 });
      const teamPayment = await seedPayment((await seedUser()).id, "succeeded", { amount: 4000, organizationId: team.id });
      const otherPayment = await seedPayment((await seedUser()).id, "succeeded", { amount: 4000 });
      await seedCommission(affiliate.userId, payment.id, { amount: 500, amountRefunded: 100, status: "succeeded" });
      await seedCommission(affiliate.userId, teamPayment.id, { amount: 200, status: "pending" });
      await seedCommission(affiliate.userId, otherPayment.id, { amount: 200, status: "succeeded" });

      const [summary] = await repository.findSummariesByAffiliate({ affiliateId: affiliate.id, affiliateUserId: affiliate.userId }, { limit: 20, offset: 0 });

      expect(summary.earnedCents).toBe(600);
    });

    it("returns zero amounts and no payment for a referral who never paid", async () => {
      const { repository, affiliate } = await setup();
      await referUser(affiliate.id);

      const [summary] = await repository.findSummariesByAffiliate({ affiliateId: affiliate.id, affiliateUserId: affiliate.userId }, { limit: 20, offset: 0 });

      expect(summary).toMatchObject({ hasPaid: false, paidCents: 0, earnedCents: 0, wallet: null });
    });

    it("returns the referral's personal wallet trial state", async () => {
      const { repository, affiliate } = await setup();
      const activatedAt = new Date("2024-06-10T00:00:00Z");
      const { user } = await seedUserWithWallet({ isTrialing: true, activatedAt });
      await container.resolve(ReferralRepository).createIfAbsent({ referredUserId: user.id, affiliateId: affiliate.id });

      const [summary] = await repository.findSummariesByAffiliate({ affiliateId: affiliate.id, affiliateUserId: affiliate.userId }, { limit: 20, offset: 0 });

      expect(summary.wallet).toEqual({ isTrialing: true, activatedAt, createdAt: expect.any(Date) });
    });
  });

  async function referUser(affiliateId: string, createdAt = new Date()) {
    const referredUserId = (await seedUser()).id;
    const [referral] = await container
      .resolve<ApiPgDatabase>(POSTGRES_DB)
      .insert(resolveTable("Referrals"))
      .values({ referredUserId, affiliateId, createdAt })
      .returning();

    return referral;
  }

  async function seedCommission(
    userId: string,
    sourceTransactionId: string,
    overrides: { amount: number; amountRefunded?: number; status: "pending" | "succeeded" }
  ) {
    return container.resolve(StripeTransactionRepository).create({
      userId,
      type: "affiliate_commission",
      currency: "usd",
      sourceTransactionId,
      amountRefunded: 0,
      ...overrides
    });
  }

  async function seedPayment(
    userId: string,
    status: "succeeded" | "refunded" | "failed",
    options: { organizationId?: string; amount?: number; amountRefunded?: number } = {}
  ) {
    return container.resolve(StripeTransactionRepository).create({
      userId,
      organizationId: options.organizationId,
      type: "payment_intent",
      status,
      amount: options.amount ?? faker.number.int({ min: 1000, max: 100000 }),
      amountRefunded: options.amountRefunded ?? 0,
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
