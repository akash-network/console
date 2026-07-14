import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { StripeTransactionRepository } from "@src/billing/repositories";
import type { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { UserRepository } from "@src/user/repositories";
import { FirstPurchaseBonusService } from "./first-purchase-bonus.service";

import { generateDatabaseStripeTransaction } from "@test/seeders/database-stripe-transaction.seeder";
import { createTestUser } from "@test/seeders/user-test.seeder";

describe(FirstPurchaseBonusService.name, () => {
  describe("getEligibleBonusAmount", () => {
    it("returns 0 for coupon claims without querying the repository", async () => {
      const { service, stripeTransactionRepository, featureFlagsService } = setup({ flagEnabled: true });
      const transaction = generateDatabaseStripeTransaction({ type: "coupon_claim" });

      const result = await service.getEligibleBonusAmount(transaction, 10000);

      expect(result).toBe(0);
      expect(featureFlagsService.isEnabled).not.toHaveBeenCalled();
      expect(stripeTransactionRepository.hasCompletedPaidTransaction).not.toHaveBeenCalled();
    });

    it("returns 0 when the feature flag is disabled", async () => {
      const { service, stripeTransactionRepository } = setup({ flagEnabled: false });
      const transaction = generateDatabaseStripeTransaction({ type: "payment_intent" });

      const result = await service.getEligibleBonusAmount(transaction, 10000);

      expect(result).toBe(0);
      expect(stripeTransactionRepository.hasCompletedPaidTransaction).not.toHaveBeenCalled();
    });

    it("returns 0 below the qualifying amount without querying the repository nor locking the user", async () => {
      const { service, stripeTransactionRepository, userRepository } = setup({ flagEnabled: true });
      const transaction = generateDatabaseStripeTransaction({ type: "payment_intent" });

      const result = await service.getEligibleBonusAmount(transaction, 9900);

      expect(result).toBe(0);
      expect(stripeTransactionRepository.hasCompletedPaidTransaction).not.toHaveBeenCalled();
      expect(userRepository.findOneByAndLock).not.toHaveBeenCalled();
    });

    it("returns 0 when the user already completed a paid purchase", async () => {
      const { service, stripeTransactionRepository } = setup({ flagEnabled: true, hasPaidBefore: true });
      const transaction = generateDatabaseStripeTransaction({ type: "payment_intent" });

      const result = await service.getEligibleBonusAmount(transaction, 10000);

      expect(result).toBe(0);
      expect(stripeTransactionRepository.hasCompletedPaidTransaction).toHaveBeenCalledWith(transaction.userId);
    });

    it("grants 10% of a qualifying first purchase", async () => {
      const { service } = setup({ flagEnabled: true, hasPaidBefore: false });
      const transaction = generateDatabaseStripeTransaction({ type: "payment_intent" });

      const result = await service.getEligibleBonusAmount(transaction, 10000);

      expect(result).toBe(1000);
    });

    it("checks the first-purchase bonus feature flag", async () => {
      const { service, featureFlagsService } = setup({ flagEnabled: true, hasPaidBefore: false });
      const transaction = generateDatabaseStripeTransaction({ type: "payment_intent" });

      await service.getEligibleBonusAmount(transaction, 10000);

      expect(featureFlagsService.isEnabled).toHaveBeenCalledWith(FeatureFlags.FIRST_PURCHASE_BONUS);
    });

    it("locks the user row before checking prior purchases so concurrent claims serialize", async () => {
      const { service, stripeTransactionRepository, userRepository } = setup({ flagEnabled: true, hasPaidBefore: false });
      const transaction = generateDatabaseStripeTransaction({ type: "payment_intent" });

      await service.getEligibleBonusAmount(transaction, 10000);

      expect(userRepository.findOneByAndLock).toHaveBeenCalledWith({ id: transaction.userId });
      expect(userRepository.findOneByAndLock.mock.invocationCallOrder[0]).toBeLessThan(
        stripeTransactionRepository.hasCompletedPaidTransaction.mock.invocationCallOrder[0]
      );
    });

    it("throws when the user row cannot be locked", async () => {
      const { service, stripeTransactionRepository } = setup({ flagEnabled: true, userLockable: false });
      const transaction = generateDatabaseStripeTransaction({ type: "payment_intent" });

      await expect(service.getEligibleBonusAmount(transaction, 10000)).rejects.toMatchObject({ status: 500 });
      expect(stripeTransactionRepository.hasCompletedPaidTransaction).not.toHaveBeenCalled();
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

  function setup(input?: { flagEnabled?: boolean; hasPaidBefore?: boolean; userLockable?: boolean }) {
    const stripeTransactionRepository = mock<StripeTransactionRepository>();
    stripeTransactionRepository.hasCompletedPaidTransaction.mockResolvedValue(input?.hasPaidBefore ?? false);

    const featureFlagsService = mock<FeatureFlagsService>();
    featureFlagsService.isEnabled.mockReturnValue(input?.flagEnabled ?? false);

    const analyticsService = mock<AnalyticsService>();

    const userRepository = mock<UserRepository>();
    userRepository.findOneByAndLock.mockResolvedValue(input?.userLockable === false ? undefined : createTestUser());

    const service = new FirstPurchaseBonusService(stripeTransactionRepository, featureFlagsService, analyticsService, userRepository);

    return { service, stripeTransactionRepository, featureFlagsService, analyticsService, userRepository };
  }
});
