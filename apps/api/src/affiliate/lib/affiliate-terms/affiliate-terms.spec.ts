import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BillingConfig } from "@src/billing/config/env.config";
import { affiliateTermsOf } from "./affiliate-terms";

describe(affiliateTermsOf.name, () => {
  it("states every term in usd and whole days from the billing config", () => {
    const billingConfig = mock<BillingConfig>({
      REFERRAL_TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT: 7_500_000,
      AFFILIATE_COMMISSION_HOLD_SECONDS: 2_592_000,
      AFFILIATE_FIRST_PURCHASE_BONUS_AMOUNT: 550,
      AFFILIATE_FIRST_PURCHASE_BONUS_MIN_PAYMENT_AMOUNT: 2500,
      AFFILIATE_FIRST_PURCHASE_BONUS_MIN_USAGE_AMOUNT: 3000
    });

    expect(affiliateTermsOf(billingConfig)).toEqual({
      commissionPercent: 5,
      commissionMonths: 3,
      referralTrialCreditsUsd: 7.5,
      commissionHoldDays: 30,
      firstPurchaseBonusUsd: 5.5,
      firstPurchaseBonusMinPaymentUsd: 25,
      firstPurchaseBonusMinUsageUsd: 30
    });
  });

  it("rounds a hold that ends part-way through a day up to the next whole day", () => {
    const billingConfig = mock<BillingConfig>({ AFFILIATE_COMMISSION_HOLD_SECONDS: 86_401 });

    expect(affiliateTermsOf(billingConfig).commissionHoldDays).toBe(2);
  });
});
