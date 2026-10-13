import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { StripeTransactionRepository } from "@src/billing/repositories";
import type { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import type { OrganizationOutput, OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import type { UserRepository } from "@src/user/repositories";
import { FirstPurchaseBonusService } from "./first-purchase-bonus.service";

import { generateDatabaseStripeTransaction } from "@test/seeders/database-stripe-transaction.seeder";
import { createOrganization } from "@test/seeders/organization.seeder";
import { createTestUser } from "@test/seeders/user-test.seeder";

describe(FirstPurchaseBonusService.name, () => {
  describe("getEligibleBonusAmount", () => {
    it("returns 0 for coupon claims without querying the repository", async () => {
      const { service, stripeTransactionRepository } = setup();
      const transaction = generateDatabaseStripeTransaction({ type: "coupon_claim" });

      const result = await service.getEligibleBonusAmount(transaction, 10000);

      expect(result).toBe(0);
      expect(stripeTransactionRepository.hasCompletedPaidTransaction).not.toHaveBeenCalled();
      expect(stripeTransactionRepository.hasReceivedFirstPurchaseBonus).not.toHaveBeenCalled();
    });

    it("returns 0 below the qualifying amount without querying the repository nor locking anything", async () => {
      const { service, stripeTransactionRepository, userRepository, organizationRepository } = setup();
      const transaction = generateDatabaseStripeTransaction({ type: "payment_intent", organizationId: "org-1" });

      const result = await service.getEligibleBonusAmount(transaction, 9900);

      expect(result).toBe(0);
      expect(stripeTransactionRepository.hasCompletedPaidTransaction).not.toHaveBeenCalled();
      expect(userRepository.findOneByAndLock).not.toHaveBeenCalled();
      expect(organizationRepository.findOneByAndLock).not.toHaveBeenCalled();
    });

    it("grants nothing for a team's payment whose member has deleted their account, without locking anyone", async () => {
      const { service, stripeTransactionRepository, userRepository, organizationRepository } = setup();
      const transaction = generateDatabaseStripeTransaction({ type: "payment_intent", userId: null, organizationId: "org-1" });

      const result = await service.getEligibleBonusAmount(transaction, 10000);

      expect(result).toBe(0);
      expect(userRepository.findOneByAndLock).not.toHaveBeenCalled();
      expect(organizationRepository.findOneByAndLock).not.toHaveBeenCalled();
      expect(stripeTransactionRepository.hasCompletedPaidTransaction).not.toHaveBeenCalled();
    });

    it("grants 10% of a qualifying first purchase by a person who never received the bonus", async () => {
      const { service } = setup();
      const transaction = generateDatabaseStripeTransaction({ type: "payment_intent" });

      const result = await service.getEligibleBonusAmount(transaction, 10000);

      expect(result).toBe(1000);
    });

    it("returns 0 when the paying account already completed a paid purchase", async () => {
      const { service } = setup({ accountHasPaid: true });
      const transaction = generateDatabaseStripeTransaction({ type: "payment_intent" });

      const result = await service.getEligibleBonusAmount(transaction, 10000);

      expect(result).toBe(0);
    });

    it("returns 0 when the person already received the bonus", async () => {
      const { service, stripeTransactionRepository } = setup({ personHasBonus: true });
      const transaction = generateDatabaseStripeTransaction({ type: "payment_intent" });

      const result = await service.getEligibleBonusAmount(transaction, 10000);

      expect(result).toBe(0);
      expect(stripeTransactionRepository.hasReceivedFirstPurchaseBonus).toHaveBeenCalledWith(transaction.userId);
    });

    it("checks the purchases of the team a transaction was paid for", async () => {
      const team = createOrganization({ type: "team" });
      const { service, stripeTransactionRepository, organizationRepository } = setup({ organization: team });
      const transaction = generateDatabaseStripeTransaction({ type: "payment_intent", organizationId: team.id });

      await service.getEligibleBonusAmount(transaction, 10000);

      expect(organizationRepository.findOneByAndLock).toHaveBeenCalledWith({ id: team.id }, { strength: "no key update" });
      expect(stripeTransactionRepository.hasCompletedPaidTransaction).toHaveBeenCalledWith({ organizationId: team.id });
    });

    it("checks the person's own purchases for a transaction paid for a personal organization", async () => {
      const personal = createOrganization({ type: "personal" });
      const { service, stripeTransactionRepository } = setup({ organization: personal });
      const transaction = generateDatabaseStripeTransaction({ type: "payment_intent", organizationId: personal.id });

      await service.getEligibleBonusAmount(transaction, 10000);

      expect(stripeTransactionRepository.hasCompletedPaidTransaction).toHaveBeenCalledWith({ userId: transaction.userId });
    });

    it("checks the person's own purchases without locking an organization for a transaction filed under none", async () => {
      const { service, stripeTransactionRepository, organizationRepository } = setup();
      const transaction = generateDatabaseStripeTransaction({ type: "payment_intent", organizationId: null });

      await service.getEligibleBonusAmount(transaction, 10000);

      expect(organizationRepository.findOneByAndLock).not.toHaveBeenCalled();
      expect(stripeTransactionRepository.hasCompletedPaidTransaction).toHaveBeenCalledWith({ userId: transaction.userId });
    });

    it("locks the paying organization, then the person, before checking eligibility", async () => {
      const team = createOrganization({ type: "team" });
      const { service, stripeTransactionRepository, userRepository, organizationRepository } = setup({ organization: team });
      const transaction = generateDatabaseStripeTransaction({ type: "payment_intent", organizationId: team.id });

      await service.getEligibleBonusAmount(transaction, 10000);

      expect(userRepository.findOneByAndLock).toHaveBeenCalledWith({ id: transaction.userId }, { strength: "no key update" });
      const [organizationLock] = organizationRepository.findOneByAndLock.mock.invocationCallOrder;
      const [personLock] = userRepository.findOneByAndLock.mock.invocationCallOrder;
      const [accountCheck] = stripeTransactionRepository.hasCompletedPaidTransaction.mock.invocationCallOrder;
      const [personCheck] = stripeTransactionRepository.hasReceivedFirstPurchaseBonus.mock.invocationCallOrder;
      expect(organizationLock).toBeLessThan(personLock);
      expect(personLock).toBeLessThan(accountCheck);
      expect(personLock).toBeLessThan(personCheck);
    });

    it("throws when the user row cannot be locked", async () => {
      const { service, stripeTransactionRepository } = setup({ userLockable: false });
      const transaction = generateDatabaseStripeTransaction({ type: "payment_intent" });

      await expect(service.getEligibleBonusAmount(transaction, 10000)).rejects.toMatchObject({
        status: 500,
        message: "Failed to lock user for first-purchase bonus eligibility",
        userId: transaction.userId
      });
      expect(stripeTransactionRepository.hasCompletedPaidTransaction).not.toHaveBeenCalled();
    });
  });

  describe("isEligible", () => {
    it.each([
      { accountHasPaid: false, personHasBonus: false, expected: true },
      { accountHasPaid: true, personHasBonus: false, expected: false },
      { accountHasPaid: false, personHasBonus: true, expected: false },
      { accountHasPaid: true, personHasBonus: true, expected: false }
    ])("returns $expected when the account has paid is $accountHasPaid and the person has a bonus is $personHasBonus", async input => {
      const { service } = setup(input);

      await expect(service.isEligible({ organizationId: "org-1" }, "user-1")).resolves.toBe(input.expected);
    });

    it("asks about the given paying account and person", async () => {
      const { service, stripeTransactionRepository } = setup();

      await service.isEligible({ organizationId: "org-1" }, "user-1");

      expect(stripeTransactionRepository.hasCompletedPaidTransaction).toHaveBeenCalledWith({ organizationId: "org-1" });
      expect(stripeTransactionRepository.hasReceivedFirstPurchaseBonus).toHaveBeenCalledWith("user-1");
    });
  });

  describe("calculateBonusCents", () => {
    it("returns 0 below the $100 minimum", () => {
      const { service } = setup();

      expect(service.calculateBonusCents(9900)).toBe(0);
      expect(service.calculateBonusCents(0)).toBe(0);
    });

    it("returns 10% of the paid amount at or above the minimum", () => {
      const { service } = setup();

      expect(service.calculateBonusCents(10000)).toBe(1000);
      expect(service.calculateBonusCents(100000)).toBe(10000);
    });

    it("caps the bonus at $100", () => {
      const { service } = setup();

      expect(service.calculateBonusCents(1000000)).toBe(10000);
    });

    it("floors non-round amounts", () => {
      const { service } = setup();

      expect(service.calculateBonusCents(10009)).toBe(1000);
    });
  });

  describe("trackBonusGranted", () => {
    it("tracks the grant with paid and bonus amounts", () => {
      const { service, analyticsService } = setup();

      service.trackBonusGranted("user-1", 15000, 1500);

      expect(analyticsService.track).toHaveBeenCalledWith("user-1", "first_purchase_bonus_granted", {
        paid_amount_cents: 15000,
        paid_amount_usd: 150,
        bonus_amount_cents: 1500,
        bonus_amount_usd: 15
      });
    });
  });

  function setup(input?: { accountHasPaid?: boolean; personHasBonus?: boolean; userLockable?: boolean; organization?: OrganizationOutput }) {
    const stripeTransactionRepository = mock<StripeTransactionRepository>();
    stripeTransactionRepository.hasCompletedPaidTransaction.mockResolvedValue(input?.accountHasPaid ?? false);
    stripeTransactionRepository.hasReceivedFirstPurchaseBonus.mockResolvedValue(input?.personHasBonus ?? false);

    const analyticsService = mock<AnalyticsService>();

    const userRepository = mock<UserRepository>();
    userRepository.findOneByAndLock.mockResolvedValue(input?.userLockable === false ? undefined : createTestUser());

    const organizationRepository = mock<OrganizationRepository>();
    organizationRepository.findOneByAndLock.mockResolvedValue(input?.organization);

    const service = new FirstPurchaseBonusService(stripeTransactionRepository, analyticsService, userRepository, organizationRepository);

    return { service, stripeTransactionRepository, analyticsService, userRepository, organizationRepository };
  }
});
