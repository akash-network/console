import type { LoggerService } from "@akashnetwork/logging";
import { addDays } from "date-fns";
import assert from "http-assert";
import maxBy from "lodash/maxBy";
import { inject, singleton } from "tsyringe";

import type { FirstPurchaseBonusWindowOpened } from "@src/billing/events/first-purchase-bonus-window-opened";
import type { BillingOwner } from "@src/billing/lib/billing-owner/billing-owner";
import { type StripeTransactionOutput, StripeTransactionRepository } from "@src/billing/repositories";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import { OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import { UserRepository } from "@src/user/repositories";

/** Smallest purchase that qualifies for the first-purchase bonus, in cents. */
export const MIN_QUALIFYING_AMOUNT_CENTS = 100_00;
/** Bonus granted as a percentage of the paid amount. */
export const BONUS_PERCENT = 10;
/** Bonus ceiling, in cents. */
export const MAX_BONUS_CENTS = 100_00;
export const SMALL_FIRST_PURCHASE_WINDOW_DAYS = 7;

export type BonusWindowReason = "small_first_purchase" | "gpu_win_back";

export interface BonusEligibility {
  eligible: boolean;
  endsAt: Date | null;
  window: BonusWindowReason | null;
}

export interface EligibleBonus {
  bonusCents: number;
  window: BonusWindowReason | null;
}

interface BonusWindow {
  reason: BonusWindowReason;
  closesAt: Date;
}

@singleton()
export class FirstPurchaseBonusService {
  readonly #logger: LoggerService;

  constructor(
    private readonly stripeTransactionRepository: StripeTransactionRepository,
    private readonly analyticsService: AnalyticsService,
    private readonly userRepository: UserRepository,
    private readonly organizationRepository: OrganizationRepository,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: FirstPurchaseBonusService.name });
  }

  /** Locking the paying organization, then the person, serializes concurrent settlements that share either. */
  async getEligibleBonusAmount(transaction: StripeTransactionOutput, paidAmountCents: number): Promise<EligibleBonus> {
    if (transaction.type !== "payment_intent" || !transaction.userId) return { bonusCents: 0, window: null };

    const bonusCents = this.calculateBonusCents(paidAmountCents);
    if (bonusCents === 0) return { bonusCents: 0, window: null };

    const payingAccount = await this.#lockPayingAccount(transaction.organizationId, transaction.userId);
    const person = await this.userRepository.findOneByAndLock({ id: transaction.userId }, { strength: "no key update" });
    assert(person, 500, "Failed to lock user for first-purchase bonus eligibility", { userId: transaction.userId });

    const { eligible, window } = await this.evaluate(payingAccount, transaction.userId, transaction.createdAt, { excludeTransactionId: transaction.id });

    return eligible ? { bonusCents, window } : { bonusCents: 0, window: null };
  }

  /** A person who never received the bonus earns it on an account that never paid, or on their own account while one of its windows is open. */
  async evaluate(payingAccount: BillingOwner, userId: string, at: Date, options?: { excludeTransactionId?: string }): Promise<BonusEligibility> {
    if (await this.stripeTransactionRepository.hasReceivedFirstPurchaseBonus(userId)) return { eligible: false, endsAt: null, window: null };

    const firstPayment = await this.stripeTransactionRepository.findEarliestCompletedPaidTransaction(payingAccount, {
      excludeId: options?.excludeTransactionId
    });
    if (!firstPayment) return { eligible: true, endsAt: null, window: null };

    const openWindow = "userId" in payingAccount ? await this.#findLatestOpenWindow(payingAccount.userId, firstPayment, at) : undefined;

    return openWindow ? { eligible: true, endsAt: openWindow.closesAt, window: openWindow.reason } : { eligible: false, endsAt: null, window: null };
  }

  /** Called once the payment has earned no bonus: a personal account's first card payment then leaves the person a window to earn it. */
  async findWindowOpenedBy(transaction: StripeTransactionOutput): Promise<FirstPurchaseBonusWindowOpened["data"] | undefined> {
    if (transaction.type !== "payment_intent" || !transaction.userId || (await this.#isPaidByTeam(transaction.organizationId))) return undefined;

    const { eligible, window } = await this.evaluate({ userId: transaction.userId }, transaction.userId, transaction.createdAt, {
      excludeTransactionId: transaction.id
    });
    if (!eligible || window) return undefined;

    return {
      userId: transaction.userId,
      reason: "small_first_purchase",
      closesAt: addDays(transaction.createdAt, SMALL_FIRST_PURCHASE_WINDOW_DAYS).toISOString()
    };
  }

  async #isPaidByTeam(organizationId: StripeTransactionOutput["organizationId"]): Promise<boolean> {
    if (!organizationId) return false;

    return (await this.organizationRepository.findById(organizationId))?.type === "team";
  }

  async isEligible(payingAccount: BillingOwner, userId: string, at = new Date()): Promise<boolean> {
    return (await this.evaluate(payingAccount, userId, at)).eligible;
  }

  async #findLatestOpenWindow(userId: string, firstPayment: { createdAt: Date; amount: number }, at: Date): Promise<BonusWindow | undefined> {
    const windows = [this.#findSmallFirstPurchaseWindow(firstPayment), await this.#findWinBackWindow(userId)];

    return maxBy(
      windows.filter((window): window is BonusWindow => window !== null && window.closesAt > at),
      window => window.closesAt.getTime()
    );
  }

  #findSmallFirstPurchaseWindow({ createdAt, amount }: { createdAt: Date; amount: number }): BonusWindow | null {
    if (amount >= MIN_QUALIFYING_AMOUNT_CENTS) return null;

    return { reason: "small_first_purchase", closesAt: addDays(createdAt, SMALL_FIRST_PURCHASE_WINDOW_DAYS) };
  }

  /** Inert until the GPU win-back (CON-1166) records a window per person. */
  async #findWinBackWindow(_userId: string): Promise<BonusWindow | null> {
    return null;
  }

  /** The person's one-bonus index backs up the eligibility check, so when it refuses the bonus the payment settles without one. */
  async recordGrant(transaction: StripeTransactionOutput, bonusCents: number): Promise<number> {
    if (bonusCents === 0) return 0;

    if (await this.stripeTransactionRepository.recordFirstPurchaseBonus(transaction.id, bonusCents)) return bonusCents;

    this.#logger.warn({
      event: "FIRST_PURCHASE_BONUS_REFUSED",
      transactionId: transaction.id,
      userId: transaction.userId,
      bonusAmountCents: bonusCents
    });

    return 0;
  }

  async #lockPayingAccount(organizationId: StripeTransactionOutput["organizationId"], userId: string): Promise<BillingOwner> {
    const organization = organizationId ? await this.organizationRepository.findOneByAndLock({ id: organizationId }, { strength: "no key update" }) : undefined;

    return organization?.type === "team" ? { organizationId: organization.id } : { userId };
  }

  /** `amount_received` can be non-round; flooring keeps the grant conservative. */
  calculateBonusCents(paidAmountCents: number): number {
    if (paidAmountCents < MIN_QUALIFYING_AMOUNT_CENTS) return 0;

    return Math.min(Math.floor((paidAmountCents * BONUS_PERCENT) / 100), MAX_BONUS_CENTS);
  }

  trackBonusGranted(userId: string, paidAmountCents: number, bonusAmountCents: number, window: BonusWindowReason | null): void {
    this.analyticsService.track(userId, "first_purchase_bonus_granted", {
      paid_amount_cents: paidAmountCents,
      paid_amount_usd: paidAmountCents / 100,
      bonus_amount_cents: bonusAmountCents,
      bonus_amount_usd: bonusAmountCents / 100,
      window: window ?? "none"
    });
  }
}
