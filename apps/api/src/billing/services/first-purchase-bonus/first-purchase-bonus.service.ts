import { singleton } from "tsyringe";

import { type StripeTransactionOutput, StripeTransactionRepository } from "@src/billing/repositories";
import { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";

/** Smallest purchase that qualifies for the first-purchase bonus, in cents. */
const MIN_QUALIFYING_AMOUNT_CENTS = 100_00;
/** Bonus granted as a percentage of the paid amount. */
const BONUS_PERCENT = 10;
/** Bonus ceiling, in cents. */
const MAX_BONUS_CENTS = 100_00;

@singleton()
export class FirstPurchaseBonusService {
  constructor(
    private readonly stripeTransactionRepository: StripeTransactionRepository,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly analyticsService: AnalyticsService
  ) {}

  /**
   * Bonus (in cents) the given transaction earns, or 0 when it doesn't qualify.
   *
   * Must run inside the webhook's transaction scope BEFORE the row's status flips to
   * "succeeded", so the current payment is not counted as its own prior purchase.
   * Coupon claims neither earn the bonus nor consume eligibility.
   *
   * Known accepted race: two first-ever payment intents succeeding concurrently lock
   * different rows and could both grant. Bounded at MAX_BONUS_CENTS per user; no
   * user-level lock here.
   */
  async getEligibleBonusAmount(transaction: StripeTransactionOutput, paidAmountCents: number): Promise<number> {
    if (transaction.type !== "payment_intent") return 0;
    if (!this.featureFlagsService.isEnabled(FeatureFlags.FIRST_PURCHASE_BONUS)) return 0;

    const bonusCents = this.calculateBonusCents(paidAmountCents);
    if (bonusCents === 0) return 0;

    const hasPaidBefore = await this.stripeTransactionRepository.hasCompletedPaidTransaction(transaction.userId);
    return hasPaidBefore ? 0 : bonusCents;
  }

  /** `amount_received` can be non-round; flooring keeps the grant conservative. */
  calculateBonusCents(paidAmountCents: number): number {
    if (paidAmountCents < MIN_QUALIFYING_AMOUNT_CENTS) return 0;

    return Math.min(Math.floor((paidAmountCents * BONUS_PERCENT) / 100), MAX_BONUS_CENTS);
  }

  trackBonusGranted(userId: string, paidAmountCents: number, bonusAmountCents: number): void {
    this.analyticsService.track(userId, "first_purchase_bonus_granted", {
      paid_amount_cents: paidAmountCents,
      paid_amount_usd: paidAmountCents / 100,
      bonus_amount_cents: bonusAmountCents,
      bonus_amount_usd: bonusAmountCents / 100
    });
  }
}
