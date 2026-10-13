import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { FirstPurchaseBonusService } from "@src/billing/services/first-purchase-bonus/first-purchase-bonus.service";
import { FirstPurchaseBonusOfferService } from "./first-purchase-bonus-offer.service";

import { createUser } from "@test/seeders/user.seeder";

describe(FirstPurchaseBonusOfferService.name, () => {
  it("returns null when the user's own account or the user is no longer eligible", async () => {
    const user = createUser();
    const { service, firstPurchaseBonusService } = setup({ isEligible: false });

    const result = await service.resolve(user);

    expect(result).toBeNull();
    expect(firstPurchaseBonusService.isEligible).toHaveBeenCalledWith({ userId: user.id }, user.id);
  });

  it("returns the offer when the user is eligible", async () => {
    const user = createUser();
    const { service } = setup({ isEligible: true });

    const result = await service.resolve(user);

    expect(result).toEqual({ bonusPercent: 10, minPurchaseUsd: 100, maxBonusUsd: 100 });
  });

  function setup(input: { isEligible: boolean }) {
    const mocks = {
      firstPurchaseBonusService: mock<FirstPurchaseBonusService>({
        isEligible: vi.fn().mockResolvedValue(input.isEligible)
      })
    };

    const service = new FirstPurchaseBonusOfferService(mocks.firstPurchaseBonusService);

    return { service, ...mocks };
  }
});
