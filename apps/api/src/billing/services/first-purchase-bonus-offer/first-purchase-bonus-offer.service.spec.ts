import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { StripeTransactionRepository } from "@src/billing/repositories";
import { FirstPurchaseBonusOfferService } from "./first-purchase-bonus-offer.service";

import { createUser } from "@test/seeders/user.seeder";

describe(FirstPurchaseBonusOfferService.name, () => {
  it("returns null when the user has already completed a paid transaction", async () => {
    const user = createUser();
    const { service, stripeTransactionRepository } = setup({ hasPaidBefore: true });

    const result = await service.resolve(user);

    expect(result).toBeNull();
    expect(stripeTransactionRepository.hasCompletedPaidTransaction).toHaveBeenCalledWith(user.id);
  });

  it("returns the offer when the user has not paid before", async () => {
    const user = createUser();
    const { service } = setup({ hasPaidBefore: false });

    const result = await service.resolve(user);

    expect(result).toEqual({ bonusPercent: 10, minPurchaseUsd: 100, maxBonusUsd: 100 });
  });

  function setup(input: { hasPaidBefore?: boolean }) {
    const mocks = {
      stripeTransactionRepository: mock<StripeTransactionRepository>({
        hasCompletedPaidTransaction: vi.fn().mockResolvedValue(input.hasPaidBefore ?? false)
      })
    };

    const service = new FirstPurchaseBonusOfferService(mocks.stripeTransactionRepository);

    return { service, ...mocks };
  }
});
