import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { StripeTransactionRepository } from "@src/billing/repositories";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { FirstPurchaseBonusOfferService } from "./first-purchase-bonus-offer.service";

import { createUser } from "@test/seeders/user.seeder";

describe(FirstPurchaseBonusOfferService.name, () => {
  it("returns null and skips the repository lookup when the feature flag is disabled", async () => {
    const user = createUser();
    const { service, featureFlagsService, stripeTransactionRepository } = setup({ flagEnabled: false });

    const result = await service.resolve(user);

    expect(result).toBeNull();
    expect(featureFlagsService.isEnabled).toHaveBeenCalledWith(FeatureFlags.FIRST_PURCHASE_BONUS);
    expect(stripeTransactionRepository.hasCompletedPaidTransaction).not.toHaveBeenCalled();
  });

  it("returns null when the user has already completed a paid transaction", async () => {
    const user = createUser();
    const { service, stripeTransactionRepository } = setup({ flagEnabled: true, hasPaidBefore: true });

    const result = await service.resolve(user);

    expect(result).toBeNull();
    expect(stripeTransactionRepository.hasCompletedPaidTransaction).toHaveBeenCalledWith(user.id);
  });

  it("returns the offer when the flag is enabled and the user has not paid before", async () => {
    const user = createUser();
    const { service } = setup({ flagEnabled: true, hasPaidBefore: false });

    const result = await service.resolve(user);

    expect(result).toEqual({ bonusPercent: 10, minPurchaseUsd: 100, maxBonusUsd: 100 });
  });

  function setup(input: { flagEnabled: boolean; hasPaidBefore?: boolean }) {
    const mocks = {
      featureFlagsService: mock<FeatureFlagsService>({
        isEnabled: vi.fn().mockReturnValue(input.flagEnabled)
      }),
      stripeTransactionRepository: mock<StripeTransactionRepository>({
        hasCompletedPaidTransaction: vi.fn().mockResolvedValue(input.hasPaidBefore ?? false)
      })
    };

    const service = new FirstPurchaseBonusOfferService(mocks.featureFlagsService, mocks.stripeTransactionRepository);

    return { service, ...mocks };
  }
});
