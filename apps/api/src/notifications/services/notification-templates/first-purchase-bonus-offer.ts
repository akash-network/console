import type { FirstPurchaseBonusOffer } from "@src/billing/services/first-purchase-bonus-offer/first-purchase-bonus-offer.service";

/**
 * Sentence appended to trial conversion emails promoting the first-purchase bonus.
 * Returns "" when there is no active offer. Accepts undefined because jobs enqueued before
 * this field existed omit it (and ResolvedValue<Offer | null> erases null to the offer shape).
 */
export function firstPurchaseBonusSentence(offer: FirstPurchaseBonusOffer | null | undefined): string {
  if (!offer) return "";
  return (
    ` <strong>Plus:</strong> get ${offer.bonusPercent}% in bonus credits on your first purchase of $${offer.minPurchaseUsd} or more, ` +
    `up to $${offer.maxBonusUsd} in bonus credits.`
  );
}
