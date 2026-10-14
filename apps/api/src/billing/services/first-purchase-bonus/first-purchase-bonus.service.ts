import assert from "http-assert";
import { singleton } from "tsyringe";

import type { BillingOwner } from "@src/billing/lib/billing-owner/billing-owner";
import { type StripeTransactionOutput, StripeTransactionRepository } from "@src/billing/repositories";
import { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import { OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import { UserRepository } from "@src/user/repositories";

/** Smallest purchase that qualifies for the first-purchase bonus, in cents. */
export const MIN_QUALIFYING_AMOUNT_CENTS = 100_00;
/** Bonus granted as a percentage of the paid amount. */
export const BONUS_PERCENT = 10;
/** Bonus ceiling, in cents. */
export const MAX_BONUS_CENTS = 100_00;

@singleton()
export class FirstPurchaseBonusService {
  constructor(
    private readonly stripeTransactionRepository: StripeTransactionRepository,
    private readonly analyticsService: AnalyticsService,
    private readonly userRepository: UserRepository,
    private readonly organizationRepository: OrganizationRepository
  ) {}

  /** Locking the paying organization, then the person, serializes concurrent settlements that share either. */
  async getEligibleBonusAmount(transaction: StripeTransactionOutput, paidAmountCents: number): Promise<number> {
    if (transaction.type !== "payment_intent") return 0;

    const bonusCents = this.calculateBonusCents(paidAmountCents);
    if (bonusCents === 0) return 0;

    const payingAccount = await this.#lockPayingAccount(transaction);
    const person = await this.userRepository.findOneByAndLock({ id: transaction.userId }, { strength: "no key update" });
    assert(person, 500, "Failed to lock user for first-purchase bonus eligibility", { userId: transaction.userId });

    return (await this.isEligible(payingAccount, transaction.userId)) ? bonusCents : 0;
  }

  /** The first purchase of a paying account earns the bonus, unless the person paying already received one under any account. */
  async isEligible(payingAccount: BillingOwner, userId: string): Promise<boolean> {
    if (await this.stripeTransactionRepository.hasCompletedPaidTransaction(payingAccount)) return false;

    return !(await this.stripeTransactionRepository.hasReceivedFirstPurchaseBonus(userId));
  }

  async #lockPayingAccount(transaction: StripeTransactionOutput): Promise<BillingOwner> {
    const organization = transaction.organizationId
      ? await this.organizationRepository.findOneByAndLock({ id: transaction.organizationId }, { strength: "no key update" })
      : undefined;

    return organization?.type === "team" ? { organizationId: organization.id } : { userId: transaction.userId };
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
