import { addMonths, isAfter } from "date-fns";
import { inject, singleton } from "tsyringe";

import { AFFILIATE_COMMISSION_MONTHS, AFFILIATE_COMMISSION_PERCENT } from "@src/affiliate/lib/affiliate-terms/affiliate-terms";
import { ReferralRepository, type ReferralWithAffiliate } from "@src/affiliate/repositories/referral/referral.repository";
import { PaymentMethodRepository, SETTLED_TRANSACTION_STATUSES, type StripeTransactionOutput, StripeTransactionRepository } from "@src/billing/repositories";
import { RefillService } from "@src/billing/services/refill/refill.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { isUniqueViolation } from "@src/core/repositories/base.repository";
import { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { TxService } from "@src/core/services/tx/tx.service";

type SkipReason = "not_referred" | "program_disabled" | "affiliate_revoked" | "commission_window_ended" | "below_one_cent" | "shared_payment_method";

@singleton()
export class AffiliateCommissionService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly stripeTransactionRepository: StripeTransactionRepository,
    private readonly referralRepository: ReferralRepository,
    private readonly paymentMethodRepository: PaymentMethodRepository,
    private readonly refillService: RefillService,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly analyticsService: AnalyticsService,
    private readonly txService: TxService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: AffiliateCommissionService.name });
  }

  /** Holds the payment row lock until commit, so syncs of one payment run in turn and each sees the commission the previous one recorded. */
  async syncCommission(transactionId: string): Promise<void> {
    await this.txService.transaction(async () => {
      const payment = await this.stripeTransactionRepository.findOneByAndLock({ id: transactionId });
      if (!payment || payment.type !== "payment_intent" || !SETTLED_TRANSACTION_STATUSES.has(payment.status)) return;

      const commission = await this.stripeTransactionRepository.findAffiliateCommissionBySourceAndLock(payment.id);
      if (commission) return;

      await this.#grant(payment);
    });
  }

  async #grant(payment: StripeTransactionOutput): Promise<void> {
    const attribution = await this.referralRepository.findWithAffiliateByReferredUserId(payment.userId);
    if (!attribution) return this.#skip(payment, "not_referred");

    const { affiliate } = attribution;
    const amount = Math.floor((payment.amount * AFFILIATE_COMMISSION_PERCENT) / 100);
    const skipReason = await this.#findSkipReason(payment, attribution, amount);
    if (skipReason) return this.#skip(payment, skipReason);

    const commission = await this.#recordCommission({ userId: affiliate.userId, amount, sourceTransactionId: payment.id });
    if (!commission) return;

    await this.refillService.topUpWallet(amount, affiliate.userId, {
      endTrial: false,
      liftAbuseLock: false,
      payment: { source: "affiliate_commission", transactionId: commission.id, currency: "usd" }
    });

    this.analyticsService.track(affiliate.userId, "affiliate_commission_granted", {
      amount_cents: amount,
      source_transaction_id: payment.id,
      referred_user_id: payment.userId
    });
    this.#logger.info({
      event: "AFFILIATE_COMMISSION_GRANTED",
      commissionId: commission.id,
      affiliateUserId: affiliate.userId,
      sourceTransactionId: payment.id,
      amountCents: amount
    });
  }

  async #findSkipReason(payment: StripeTransactionOutput, { referral, affiliate }: ReferralWithAffiliate, amount: number): Promise<SkipReason | undefined> {
    if (!this.featureFlagsService.isEnabled(FeatureFlags.AFFILIATE_PROGRAM, { userId: affiliate.userId })) return "program_disabled";
    if (affiliate.revokedAt) return "affiliate_revoked";
    if (isAfter(payment.createdAt, addMonths(new Date(referral.createdAt), AFFILIATE_COMMISSION_MONTHS))) return "commission_window_ended";
    if (amount <= 0) return "below_one_cent";
    if (await this.paymentMethodRepository.hasSharedFingerprint(payment.userId, affiliate.userId)) return "shared_payment_method";

    return undefined;
  }

  /** The payment row lock already serializes syncs, so a unique violation here means a commission landed outside that lock and must not be credited twice. */
  async #recordCommission(input: { userId: string; amount: number; sourceTransactionId: string }): Promise<StripeTransactionOutput | undefined> {
    try {
      return await this.stripeTransactionRepository.createAffiliateCommission(input);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;

      this.#logger.warn({ event: "AFFILIATE_COMMISSION_ALREADY_GRANTED", transactionId: input.sourceTransactionId });
      return undefined;
    }
  }

  #skip(payment: StripeTransactionOutput, reason: SkipReason): void {
    this.#logger.debug({ event: "AFFILIATE_COMMISSION_SKIPPED", transactionId: payment.id, reason });
  }
}
