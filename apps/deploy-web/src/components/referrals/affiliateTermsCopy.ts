import type { AffiliateProfile } from "@src/queries/useAffiliateProfileQuery";

export function describeFirstPaymentBonus({
  commissionMonths,
  firstPurchaseBonusUsd,
  firstPurchaseBonusMinPaymentUsd,
  firstPurchaseBonusMinUsageUsd
}: AffiliateProfile["terms"]): string | undefined {
  if (firstPurchaseBonusUsd <= 0) return undefined;

  return `plus ${formatWholeOrCents(firstPurchaseBonusUsd)} if their first payment is ${formatWholeOrCents(firstPurchaseBonusMinPaymentUsd)} or more, once they've used ${formatWholeOrCents(firstPurchaseBonusMinUsageUsd)} on deployments beyond their trial credit within those ${commissionMonths} months`;
}

export function formatWholeOrCents(amountUsd: number): string {
  return Number.isInteger(amountUsd) ? `$${amountUsd}` : `$${amountUsd.toFixed(2)}`;
}
