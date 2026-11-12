import { addMonths, addSeconds, isAfter } from "date-fns";
import { inject, singleton } from "tsyringe";

import { AFFILIATE_COMMISSION_MONTHS, AFFILIATE_COMMISSION_PERCENT } from "@src/affiliate/lib/affiliate-terms/affiliate-terms";
import { AffiliateRepository } from "@src/affiliate/repositories/affiliate/affiliate.repository";
import { ReferralRepository, type ReferralWithAffiliate } from "@src/affiliate/repositories/referral/referral.repository";
import { type BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import {
  PaymentMethodRepository,
  SETTLED_TRANSACTION_STATUSES,
  type StripeTransactionOutput,
  StripeTransactionRepository,
  UserWalletRepository
} from "@src/billing/repositories";
import { type PaymentCreditOutput, PaymentCreditRepository } from "@src/billing/repositories/payment-credit/payment-credit.repository";
import { RefillService } from "@src/billing/services/refill/refill.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { isUniqueViolation } from "@src/core/repositories/base.repository";
import { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import { TxService } from "@src/core/services/tx/tx.service";
import { OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import { type AffiliateCommissionSyncTrigger, SyncAffiliateCommission } from "./sync-affiliate-commission.job";

type SkipReason =
  | "not_referred"
  | "credit_not_landed"
  | "program_disabled"
  | "affiliate_revoked"
  | "commission_window_ended"
  | "below_one_cent"
  | "nothing_left_to_grant"
  | "affiliate_abuse_locked"
  | "shared_payment_method";

type CancelReason = Extract<SkipReason, "program_disabled" | "affiliate_revoked" | "affiliate_abuse_locked" | "nothing_left_to_grant">;

const UNCREDITED_COMMISSION_STATUSES = new Set<StripeTransactionOutput["status"]>(["pending", "canceled"]);

@singleton()
export class AffiliateCommissionService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly stripeTransactionRepository: StripeTransactionRepository,
    private readonly referralRepository: ReferralRepository,
    private readonly affiliateRepository: AffiliateRepository,
    private readonly paymentMethodRepository: PaymentMethodRepository,
    private readonly paymentCreditRepository: PaymentCreditRepository,
    private readonly organizationRepository: OrganizationRepository,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly refillService: RefillService,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly analyticsService: AnalyticsService,
    private readonly txService: TxService,
    private readonly jobQueueService: JobQueueService,
    @InjectBillingConfig() private readonly billingConfig: BillingConfig,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: AffiliateCommissionService.name });
  }

  /** Holds the payment row lock until commit, so syncs of one payment run in turn and each sees the commission the previous one recorded. */
  async syncCommission(transactionId: string, trigger: AffiliateCommissionSyncTrigger): Promise<void> {
    if (trigger === "settlement" && !(await this.#isCreditLanded(transactionId))) return this.#skip(transactionId, "credit_not_landed");
    const releaseCredit = trigger === "settlement" ? undefined : await this.#findReleaseCredit(transactionId);

    await this.txService.transaction(async () => {
      const payment = await this.stripeTransactionRepository.findOneByAndLock({ id: transactionId });
      if (!payment || payment.type !== "payment_intent" || !SETTLED_TRANSACTION_STATUSES.has(payment.status)) return;

      const commission = await this.stripeTransactionRepository.findAffiliateCommissionBySourceAndLock(payment.id);
      if (!commission) {
        if (trigger === "settlement") await this.#hold(payment);
      } else if (releaseCredit && UNCREDITED_COMMISSION_STATUSES.has(commission.status)) {
        await this.#recoverLandedRelease(payment, commission, releaseCredit, trigger);
      } else if (commission.status === "pending") {
        await (this.#isReleaseDue(payment, commission, trigger) ? this.#release(payment, commission) : this.#reconcileHeld(payment, commission));
      } else {
        await this.#reconcileReversal(payment, commission);
      }
    });
  }

  /** Reads before taking the payment row lock, because the credit repository takes its own pool connection and syncs queued on that lock each hold one. */
  async #isCreditLanded(transactionId: string): Promise<boolean> {
    const credit = await this.paymentCreditRepository.findByTransactionId(transactionId);
    return credit?.status === "landed";
  }

  /** Reads before taking the payment row lock, like `#isCreditLanded`, since the credit repository takes its own pool connection. */
  async #findReleaseCredit(transactionId: string): Promise<PaymentCreditOutput | undefined> {
    const commission = await this.stripeTransactionRepository.findAffiliateCommissionBySource(transactionId);
    return commission ? this.paymentCreditRepository.findByTransactionId(commission.id) : undefined;
  }

  /** A release whose credit landed on its own connection before its transaction rolled back leaves the row pending, or canceled by a refund that read no credit yet, so the row is recorded as credited before any refund is taken back from it. */
  async #recoverLandedRelease(
    payment: StripeTransactionOutput,
    commission: StripeTransactionOutput,
    credit: PaymentCreditOutput,
    trigger: AffiliateCommissionSyncTrigger
  ): Promise<void> {
    if (credit.status !== "landed") throw new Error(`The release credit of affiliate commission ${commission.id} is still in flight`);

    const credited = { ...commission, status: "succeeded" as const, amountRefunded: commission.amount - credit.amount };
    await this.stripeTransactionRepository.updateById(commission.id, { status: credited.status, amountRefunded: credited.amountRefunded });
    this.#logger.warn({
      event: "AFFILIATE_COMMISSION_RELEASE_RECOVERED",
      commissionId: commission.id,
      sourceTransactionId: payment.id,
      amountCents: credit.amount,
      trigger
    });

    await this.#reconcileReversal(payment, credited);
  }

  /** Records the commission without crediting it and schedules its release in the same transaction, so a refund or a lost dispute during the hold only ever edits a row. */
  async #hold(payment: StripeTransactionOutput): Promise<void> {
    const referredUserId = await this.#findReferredUserId(payment);
    if (!referredUserId) return this.#skip(payment.id, "not_referred");

    const attribution = await this.referralRepository.findWithAffiliateByReferredUserId(referredUserId);
    if (!attribution) return this.#skip(payment.id, "not_referred");

    const { affiliate } = attribution;
    const amount = Math.floor((payment.amount * AFFILIATE_COMMISSION_PERCENT) / 100);
    const keptAmount = this.#keptCommission(amount, payment);
    const skipReason = await this.#findSkipReason(payment, { referredUserId, ...attribution }, { amount, keptAmount });
    if (skipReason) return this.#skip(payment.id, skipReason);

    const commission = await this.#recordCommission({
      userId: affiliate.userId,
      organizationId: await this.#findPersonalOrganizationId(affiliate.userId),
      amount,
      amountRefunded: amount - keptAmount,
      sourceTransactionId: payment.id
    });
    if (!commission) return;

    const releasesAt = this.#releasesAt(commission);
    await this.jobQueueService.enqueue(new SyncAffiliateCommission({ transactionId: payment.id, trigger: "release" }), { startAfter: releasesAt });

    this.analyticsService.track(affiliate.userId, "affiliate_commission_held", {
      amount_cents: keptAmount,
      source_transaction_id: payment.id,
      referred_user_id: referredUserId,
      releases_at: releasesAt.toISOString()
    });
    this.#logger.info({
      event: "AFFILIATE_COMMISSION_HELD",
      commissionId: commission.id,
      affiliateUserId: affiliate.userId,
      sourceTransactionId: payment.id,
      amountCents: keptAmount,
      grossAmountCents: amount,
      releasesAt
    });
  }

  #releasesAt(commission: StripeTransactionOutput): Date {
    return addSeconds(commission.createdAt, this.billingConfig.AFFILIATE_COMMISSION_HOLD_SECONDS);
  }

  /** A dispute settled in Console's favour after the hold ended has no scheduled release left to wait for. */
  #isReleaseDue(payment: StripeTransactionOutput, commission: StripeTransactionOutput, trigger: AffiliateCommissionSyncTrigger): boolean {
    if (trigger === "release") return true;
    if (trigger !== "dispute" || payment.disputeLostAt) return false;

    return !isAfter(this.#releasesAt(commission), new Date());
  }

  #hasOpenDispute(payment: StripeTransactionOutput): boolean {
    if (!payment.disputeOpenedAt) return false;

    return !payment.disputeClosedAt || isAfter(payment.disputeOpenedAt, payment.disputeClosedAt);
  }

  /** Re-runs the checks against the payment and the affiliate as they are now, and credits only what the payer still paid. */
  async #release(payment: StripeTransactionOutput, commission: StripeTransactionOutput): Promise<void> {
    const affiliateUserId = commission.userId;
    if (!affiliateUserId) return;

    if (this.#hasOpenDispute(payment)) {
      this.#logger.info({
        event: "AFFILIATE_COMMISSION_RELEASE_DEFERRED",
        commissionId: commission.id,
        sourceTransactionId: payment.id,
        reason: "dispute_open"
      });
      return;
    }

    const releasedAmount = Math.min(commission.amount - commission.amountRefunded, this.#keptCommission(commission.amount, payment));
    const cancelReason = await this.#findCancelReason(affiliateUserId, releasedAmount);
    if (cancelReason) return this.#cancel(payment, commission, cancelReason);

    await this.stripeTransactionRepository.updateById(commission.id, { status: "succeeded", amountRefunded: commission.amount - releasedAmount });
    await this.refillService.topUpWallet(
      releasedAmount,
      { userId: affiliateUserId, organizationId: commission.organizationId },
      {
        endTrial: false,
        liftAbuseLock: false,
        payment: { source: "affiliate_commission", transactionId: commission.id, currency: "usd" }
      }
    );

    this.analyticsService.track(affiliateUserId, "affiliate_commission_released", {
      amount_cents: releasedAmount,
      source_transaction_id: payment.id,
      referred_user_id: await this.#findReferredUserId(payment)
    });
    this.#logger.info({
      event: "AFFILIATE_COMMISSION_RELEASED",
      commissionId: commission.id,
      affiliateUserId,
      sourceTransactionId: payment.id,
      amountCents: releasedAmount
    });
  }

  async #findCancelReason(affiliateUserId: string, releasedAmount: number): Promise<CancelReason | undefined> {
    if (!this.featureFlagsService.isEnabled(FeatureFlags.AFFILIATE_PROGRAM, { userId: affiliateUserId })) return "program_disabled";

    const affiliate = await this.affiliateRepository.findOneBy({ userId: affiliateUserId });
    if (!affiliate || affiliate.revokedAt) return "affiliate_revoked";
    if (await this.#isWalletAbuseLocked(affiliateUserId)) return "affiliate_abuse_locked";
    if (releasedAmount <= 0) return "nothing_left_to_grant";

    return undefined;
  }

  async #cancel(payment: StripeTransactionOutput, commission: StripeTransactionOutput, reason: CancelReason | "refund" | "dispute_lost"): Promise<void> {
    await this.stripeTransactionRepository.updateById(commission.id, { status: "canceled", amountRefunded: commission.amount });

    if (commission.userId) {
      this.analyticsService.track(commission.userId, "affiliate_commission_canceled", {
        amount_cents: commission.amount - commission.amountRefunded,
        source_transaction_id: payment.id,
        reason
      });
    }
    this.#logger.info({ event: "AFFILIATE_COMMISSION_CANCELED", commissionId: commission.id, sourceTransactionId: payment.id, reason });
  }

  /** A held commission was never credited, so a refund only shrinks what the release will credit, and a full one cancels it. */
  async #reconcileHeld(payment: StripeTransactionOutput, commission: StripeTransactionOutput): Promise<void> {
    const keptAmount = Math.min(commission.amount - commission.amountRefunded, this.#keptCommission(commission.amount, payment));
    const reason = payment.disputeLostAt ? "dispute_lost" : "refund";

    if (keptAmount <= 0) return this.#cancel(payment, commission, reason);

    const amountRefunded = commission.amount - keptAmount;
    if (amountRefunded === commission.amountRefunded) return;

    await this.stripeTransactionRepository.updateById(commission.id, { amountRefunded });
    this.#logger.info({
      event: "AFFILIATE_COMMISSION_HOLD_REDUCED",
      commissionId: commission.id,
      sourceTransactionId: payment.id,
      amountCents: keptAmount,
      reason
    });
  }

  /** A team's card payments count for the referred user who created the team, whichever member paid. */
  async #findReferredUserId(payment: StripeTransactionOutput): Promise<string | null> {
    if (!payment.organizationId) return payment.userId;

    const organization = await this.organizationRepository.findById(payment.organizationId);
    return organization?.createdByUserId ?? null;
  }

  async #findPersonalOrganizationId(userId: string): Promise<string | null> {
    const organization = await this.organizationRepository.findPersonalByUserId(userId);
    return organization?.id ?? null;
  }

  async #findSkipReason(
    payment: StripeTransactionOutput,
    { referredUserId, referral, affiliate }: ReferralWithAffiliate & { referredUserId: string },
    { amount, keptAmount }: { amount: number; keptAmount: number }
  ): Promise<SkipReason | undefined> {
    if (!this.featureFlagsService.isEnabled(FeatureFlags.AFFILIATE_PROGRAM, { userId: affiliate.userId })) return "program_disabled";
    if (affiliate.revokedAt) return "affiliate_revoked";
    if (isAfter(payment.createdAt, addMonths(new Date(referral.createdAt), AFFILIATE_COMMISSION_MONTHS))) return "commission_window_ended";
    if (amount <= 0) return "below_one_cent";
    if (keptAmount <= 0) return "nothing_left_to_grant";
    if (await this.#isWalletAbuseLocked(affiliate.userId)) return "affiliate_abuse_locked";

    const payer = { userId: referredUserId, organizationId: payment.organizationId };
    if (await this.paymentMethodRepository.hasSharedFingerprint(payer, affiliate.userId)) return "shared_payment_method";

    return undefined;
  }

  async #isWalletAbuseLocked(userId: string): Promise<boolean> {
    const wallet = await this.userWalletRepository.findOneByUserId(userId);
    return !!wallet?.abuseLockedAt;
  }

  /** The payment row lock already serializes syncs, so a unique violation here means a commission landed outside that lock and must not be credited twice. */
  async #recordCommission(input: {
    userId: string;
    organizationId: string | null;
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
    const affiliateUserId = commission.userId;
    if (delta <= 0 || !affiliateUserId) return;

    await this.stripeTransactionRepository.updateById(commission.id, {
      amountRefunded: targetReversed,
      ...(targetReversed >= commission.amount ? { status: "refunded" } : {})
    });
    const { shortfallCents } = await this.refillService.reduceWalletBalance(
      delta,
      { userId: affiliateUserId, organizationId: commission.organizationId },
      { currency: "usd", transactionId: commission.id, refundedBefore: commission.amountRefunded, refundedAfter: targetReversed }
    );

    const reason = payment.disputeLostAt ? "dispute_lost" : "refund";
    this.analyticsService.track(affiliateUserId, "affiliate_commission_reversed", {
      amount_cents: delta,
      source_transaction_id: payment.id,
      referred_user_id: await this.#findReferredUserId(payment),
      reason
    });
    this.#logger.info({
      event: "AFFILIATE_COMMISSION_REVERSED",
      commissionId: commission.id,
      affiliateUserId,
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

  #skip(transactionId: string, reason: SkipReason): void {
    this.#logger.debug({ event: "AFFILIATE_COMMISSION_SKIPPED", transactionId, reason });
  }
}
