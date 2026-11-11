import { describe, expect, it } from "vitest";

import { canRetryRefusedDeploy, needsFundsVariantOf } from "./needsFundsVariant";

describe(needsFundsVariantOf.name, () => {
  it("says the free trial credit is used up when a trial has nothing left", () => {
    expect(needsFundsVariantOf({ isTrialing: true, availableAmountUsd: 0, minimumDepositUsd: 0.5 })).toEqual({ name: "trial_credit_used_up" });
  });

  it("says the free trial credit is used up even before the minimum deposit is known", () => {
    expect(needsFundsVariantOf({ isTrialing: true, availableAmountUsd: 0 })).toEqual({ name: "trial_credit_used_up" });
  });

  it("says the free trial credit is below the minimum when a trial has a few cents left", () => {
    expect(needsFundsVariantOf({ isTrialing: true, availableAmountUsd: 0.43, minimumDepositUsd: 0.5 })).toEqual({
      name: "trial_credit_below_minimum",
      availableAmountUsd: 0.43,
      minimumDepositUsd: 0.5
    });
  });

  it("says the balance falls short when a trial already covers the minimum deposit", () => {
    expect(needsFundsVariantOf({ isTrialing: true, availableAmountUsd: 0.5, minimumDepositUsd: 0.5 })).toEqual({ name: "not_enough_balance" });
  });

  it("says the balance falls short when the minimum deposit of a trial with credit left is unknown", () => {
    expect(needsFundsVariantOf({ isTrialing: true, availableAmountUsd: 0.43 })).toEqual({ name: "not_enough_balance" });
  });

  it("says the balance falls short when the balance of a trial is unknown", () => {
    expect(needsFundsVariantOf({ isTrialing: true, minimumDepositUsd: 0.5 })).toEqual({ name: "not_enough_balance" });
  });

  it("says the balance falls short for a paid account, whatever it holds", () => {
    expect(needsFundsVariantOf({ isTrialing: false, availableAmountUsd: 0, minimumDepositUsd: 0.5 })).toEqual({ name: "not_enough_balance" });
  });
});

describe(canRetryRefusedDeploy.name, () => {
  it("offers a retry once the balance covers what the refused deploy needed", () => {
    expect(canRetryRefusedDeploy({ shortfall: { requiredAmountUsd: 0.5, availableAmountUsd: 0 }, balanceUsd: 0.5 })).toBe(true);
  });

  it("offers no retry while the balance still falls short", () => {
    expect(canRetryRefusedDeploy({ shortfall: { requiredAmountUsd: 0.5, availableAmountUsd: 0 }, balanceUsd: 0.49 })).toBe(false);
  });

  it("offers no retry while the balance is unknown", () => {
    expect(canRetryRefusedDeploy({ shortfall: { requiredAmountUsd: 0.5, availableAmountUsd: 0 } })).toBe(false);
  });

  it("offers no retry for a refusal that reported no amounts", () => {
    expect(canRetryRefusedDeploy({ balanceUsd: 20 })).toBe(false);
  });
});
