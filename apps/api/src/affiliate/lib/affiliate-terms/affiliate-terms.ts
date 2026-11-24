import type { BillingConfig } from "@src/billing/config/env.config";

export const AFFILIATE_COMMISSION_PERCENT = 5;
export const AFFILIATE_COMMISSION_MONTHS = 3;

const MICRO_DENOM_PER_UNIT = 1_000_000;
const CENTS_PER_USD = 100;
const SECONDS_PER_DAY = 86_400;

export type AffiliateTerms = {
  commissionPercent: number;
  commissionMonths: number;
  referralTrialCreditsUsd: number;
  commissionHoldDays: number;
  firstPurchaseBonusUsd: number;
  firstPurchaseBonusMinPaymentUsd: number;
  firstPurchaseBonusMinUsageUsd: number;
};

export function affiliateTermsOf(billingConfig: BillingConfig): AffiliateTerms {
  return {
    commissionPercent: AFFILIATE_COMMISSION_PERCENT,
    commissionMonths: AFFILIATE_COMMISSION_MONTHS,
    referralTrialCreditsUsd: billingConfig.REFERRAL_TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT / MICRO_DENOM_PER_UNIT,
    commissionHoldDays: Math.ceil(billingConfig.AFFILIATE_COMMISSION_HOLD_SECONDS / SECONDS_PER_DAY),
    firstPurchaseBonusUsd: billingConfig.AFFILIATE_FIRST_PURCHASE_BONUS_AMOUNT / CENTS_PER_USD,
    firstPurchaseBonusMinPaymentUsd: billingConfig.AFFILIATE_FIRST_PURCHASE_BONUS_MIN_PAYMENT_AMOUNT / CENTS_PER_USD,
    firstPurchaseBonusMinUsageUsd: billingConfig.AFFILIATE_FIRST_PURCHASE_BONUS_MIN_USAGE_AMOUNT / CENTS_PER_USD
  };
}
