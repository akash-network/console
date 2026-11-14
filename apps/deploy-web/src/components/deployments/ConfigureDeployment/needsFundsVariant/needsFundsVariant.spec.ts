import { describe, expect, it } from "vitest";

import { canRetryRefusedDeploy, isHeldForTrialCredit, needsFundsVariantOf } from "./needsFundsVariant";

describe(needsFundsVariantOf.name, () => {
  it("says the free trial credit is used up when a trial has nothing left", () => {
    expect(needsFundsVariantOf({ isTrialing: true, availableAmountUsd: 0, minimumDepositUsd: 0.5 })).toEqual({ name: "trial_credit_used_up" });
  });

  it("says the free trial credit is used up even before the minimum deposit is known", () => {
    expect(needsFundsVariantOf({ isTrialing: true, availableAmountUsd: 0 })).toEqual({ name: "trial_credit_used_up" });
  });

  it.each([0.004, -0.01])("says the free trial credit is used up when a trial holds %s, which displays as nothing", availableAmountUsd => {
    expect(needsFundsVariantOf({ isTrialing: true, availableAmountUsd, minimumDepositUsd: 0.5 })).toEqual({ name: "trial_credit_used_up" });
  });

  it("says the free trial credit is below the minimum when a trial has a single cent left", () => {
    expect(needsFundsVariantOf({ isTrialing: true, availableAmountUsd: 0.01, minimumDepositUsd: 0.5 })).toEqual({
      name: "trial_credit_below_minimum",
      availableAmountUsd: 0.01,
      minimumDepositUsd: 0.5
    });
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

describe(isHeldForTrialCredit.name, () => {
  const shortfall = { requiredAmountUsd: 0.5, availableAmountUsd: 0.43 };

  it("holds a trial whose credit is below the minimum while the balance still falls short", () => {
    const variant = { name: "trial_credit_below_minimum", availableAmountUsd: 0.43, minimumDepositUsd: 0.5 } as const;

    expect(isHeldForTrialCredit({ variant, shortfall, balanceUsd: 0.43 })).toBe(true);
  });

  it("holds a trial whose credit is used up while the balance still falls short", () => {
    expect(
      isHeldForTrialCredit({ variant: { name: "trial_credit_used_up" }, shortfall: { requiredAmountUsd: 0.5, availableAmountUsd: 0 }, balanceUsd: 0 })
    ).toBe(true);
  });

  it("holds a trial whose refusal reported no amounts, since nothing tells when the balance covers it", () => {
    expect(isHeldForTrialCredit({ variant: { name: "trial_credit_used_up" }, balanceUsd: 0 })).toBe(true);
  });

  it("releases a trial once the balance covers what the refused deploy needed", () => {
    expect(isHeldForTrialCredit({ variant: { name: "trial_credit_used_up" }, shortfall, balanceUsd: 0.5 })).toBe(false);
  });

  it("never holds a balance that merely falls short, since a smaller deployment can still fit it", () => {
    expect(isHeldForTrialCredit({ variant: { name: "not_enough_balance" }, shortfall, balanceUsd: 0.12 })).toBe(false);
  });
});
