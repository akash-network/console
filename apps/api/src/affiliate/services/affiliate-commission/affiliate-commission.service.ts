import { addMonths, isAfter } from "date-fns";
import { inject, singleton } from "tsyringe";

import { AFFILIATE_COMMISSION_MONTHS, AFFILIATE_COMMISSION_PERCENT } from "@src/affiliate/lib/affiliate-terms/affiliate-terms";
import { ReferralRepository, type ReferralWithAffiliate } from "@src/affiliate/repositories/referral/referral.repository";
import {
  PaymentMethodRepository,
  SETTLED_TRANSACTION_STATUSES,
  type StripeTransactionOutput,
  StripeTransactionRepository,
  UserWalletRepository
} from "@src/billing/repositories";
import { RefillService } from "@src/billing/services/refill/refill.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { isUniqueViolation } from "@src/core/repositories/base.repository";
import { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { TxService } from "@src/core/services/tx/tx.service";
import type { AffiliateCommissionSyncTrigger } from "./sync-affiliate-commission.job";

type SkipReason =
  | "not_referred"
  | "program_disabled"
  | "affiliate_revoked"
  | "commission_window_ended"
  | "below_one_cent"
  | "nothing_left_to_grant"
  | "affiliate_abuse_locked"
  | "shared_payment_method";

@singleton()
export class AffiliateCommissionService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly stripeTransactionRepository: StripeTransactionRepository,
    private readonly referralRepository: ReferralRepository,
    private readonly paymentMethodRepository: PaymentMethodRepository,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly refillService: RefillService,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly analyticsService: AnalyticsService,
    private readonly txService: TxService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: AffiliateCommissionService.name });
  }

  /** Holds the payment row lock until commit, so syncs of one payment run in turn and each sees the commission the previous one recorded. */
  async syncCommission(transactionId: string, trigger: AffiliateCommissionSyncTrigger): Promise<void> {
    await this.txService.transaction(async () => {
      const payment = await this.stripeTransactionRepository.findOneByAndLock({ id: transactionId });
      if (!payment || payment.type !== "payment_intent" || !SETTLED_TRANSACTION_STATUSES.has(payment.status)) return;

      const commission = await this.stripeTransactionRepository.findAffiliateCommissionBySourceAndLock(payment.id);
      if (commission) await this.#reconcileReversal(payment, commission);
      else if (trigger === "settlement") await this.#grant(payment);
    });
  }

  /** Credits only what is left after refunds already recorded on the payment, so the top-up stays the grant's single and last chain write. */
  async #grant(payment: StripeTransactionOutput): Promise<void> {
    const attribution = await this.referralRepository.findWithAffiliateByReferredUserId(payment.userId);
    if (!attribution) return this.#skip(payment, "not_referred");

    const { affiliate } = attribution;
    const amount = Math.floor((payment.amount * AFFILIATE_COMMISSION_PERCENT) / 100);
    const grantedAmount = this.#keptCommission(amount, payment);
    const skipReason = await this.#findSkipReason(payment, attribution, { amount, grantedAmount });
    if (skipReason) return this.#skip(payment, skipReason);

    const commission = await this.#recordCommission({
      userId: affiliate.userId,
      amount,
      amountRefunded: amount - grantedAmount,
      sourceTransactionId: payment.id
    });
    if (!commission) return;

    await this.refillService.topUpWallet(grantedAmount, affiliate.userId, {
      endTrial: false,
      liftAbuseLock: false,
      payment: { source: "affiliate_commission", transactionId: commission.id, currency: "usd" }
    });

    this.analyticsService.track(affiliate.userId, "affiliate_commission_granted", {
      amount_cents: grantedAmount,
      source_transaction_id: payment.id,
      referred_user_id: payment.userId
    });
    this.#logger.info({
      event: "AFFILIATE_COMMISSION_GRANTED",
      commissionId: commission.id,
      affiliateUserId: affiliate.userId,
      sourceTransactionId: payment.id,
      amountCents: grantedAmount,
      grossAmountCents: amount
    });
  }

  async #findSkipReason(
    payment: StripeTransactionOutput,
    { referral, affiliate }: ReferralWithAffiliate,
    { amount, grantedAmount }: { amount: number; grantedAmount: number }
  ): Promise<SkipReason | undefined> {
    if (!this.featureFlagsService.isEnabled(FeatureFlags.AFFILIATE_PROGRAM, { userId: affiliate.userId })) return "program_disabled";
    if (affiliate.revokedAt) return "affiliate_revoked";
    if (isAfter(payment.createdAt, addMonths(new Date(referral.createdAt), AFFILIATE_COMMISSION_MONTHS))) return "commission_window_ended";
    if (amount <= 0) return "below_one_cent";
    if (grantedAmount <= 0) return "nothing_left_to_grant";
    if (await this.#isWalletAbuseLocked(affiliate.userId)) return "affiliate_abuse_locked";
    if (await this.paymentMethodRepository.hasSharedFingerprint(payment.userId, affiliate.userId)) return "shared_payment_method";

    return undefined;
  }

  async #isWalletAbuseLocked(userId: string): Promise<boolean> {
    const wallet = await this.userWalletRepository.findOneByUserId(userId);
    return !!wallet?.abuseLockedAt;
  }

  /** The payment row lock already serializes syncs, so a unique violation here means a commission landed outside that lock and must not be credited twice. */
  async #recordCommission(input: {
    userId: string;
    amount: number;
    amountRefunded: number;
    sourceTransactionId: string;
  }): Promise<StripeTransactionOutput | undefined> {
    try {
      return await this.stripeTransactionRepository.createAffiliateCommission(input);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;

      this.#logger.warn({ event: "AFFILIATE_COMMISSION_ALREADY_GRANTED", transactionId: input.sourceTransactionId });
      return undefined;
    }
  }

  /** Recomputes what the commission should be from what the payer still paid, so a redelivered refund or a repeated sync takes back nothing twice. */
  async #reconcileReversal(payment: StripeTransactionOutput, commission: StripeTransactionOutput): Promise<void> {
    const keptAmount = this.#keptCommission(commission.amount, payment);
    const targetReversed = Math.min(commission.amount, Math.max(commission.amountRefunded, commission.amount - keptAmount));
    const delta = targetReversed - commission.amountRefunded;
    if (delta <= 0) return;

    await this.stripeTransactionRepository.updateById(commission.id, {
      amountRefunded: targetReversed,
      ...(targetReversed >= commission.amount ? { status: "refunded" } : {})
    });
    const { shortfallCents } = await this.refillService.reduceWalletBalance(delta, commission.userId, { currency: "usd", transactionId: commission.id });

    const reason = payment.disputeLostAt ? "dispute_lost" : "refund";
    this.analyticsService.track(commission.userId, "affiliate_commission_reversed", {
      amount_cents: delta,
      source_transaction_id: payment.id,
      referred_user_id: payment.userId,
      reason
    });
    this.#logger.info({
      event: "AFFILIATE_COMMISSION_REVERSED",
      commissionId: commission.id,
      affiliateUserId: commission.userId,
      sourceTransactionId: payment.id,
      amountCents: delta,
      totalReversedCents: targetReversed,
      shortfallCents,
      reason
    });
  }

  /** Scales the commission by the share of the payment the payer still paid, so a refund never takes back more than its share whatever rate the commission was granted at. */
  #keptCommission(commissionAmount: number, payment: StripeTransactionOutput): number {
    const netPaid = payment.disputeLostAt ? 0 : payment.amount - payment.amountRefunded;
    return Math.floor((commissionAmount * netPaid) / payment.amount);
  }

  #skip(payment: StripeTransactionOutput, reason: SkipReason): void {
    this.#logger.debug({ event: "AFFILIATE_COMMISSION_SKIPPED", transactionId: payment.id, reason });
  }
}
