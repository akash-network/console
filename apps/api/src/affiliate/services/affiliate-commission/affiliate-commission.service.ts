import { addDays, addMonths, addSeconds, isAfter, isBefore } from "date-fns";
import { inject, singleton } from "tsyringe";

import { AFFILIATE_COMMISSION_MONTHS, AFFILIATE_COMMISSION_PERCENT } from "@src/affiliate/lib/affiliate-terms/affiliate-terms";
import { AffiliateRepository } from "@src/affiliate/repositories/affiliate/affiliate.repository";
import { ReferralRepository, type ReferralWithAffiliate } from "@src/affiliate/repositories/referral/referral.repository";
import { ReferredUsageService } from "@src/affiliate/services/referred-usage/referred-usage.service";
import { type BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import {
  type AffiliateCommissionLane,
  PaymentMethodRepository,
  SETTLED_TRANSACTION_STATUSES,
  type StripeTransactionOutput,
  StripeTransactionRepository,
  UserWalletRepository
} from "@src/billing/repositories";
import { type PaymentCreditOutput, PaymentCreditRepository } from "@src/billing/repositories/payment-credit/payment-credit.repository";
import { PaymentCreditService } from "@src/billing/services/payment-credit/payment-credit.service";
import { RefillService } from "@src/billing/services/refill/refill.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { isUniqueViolation } from "@src/core/repositories/base.repository";
import { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import { TxService } from "@src/core/services/tx/tx.service";
import { OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import { PersonalOrganizationService } from "@src/organization/services/personal-organization/personal-organization.service";
import { UserRepository } from "@src/user/repositories/user/user.repository";
import type { DeletedPaymentReversal } from "./reverse-deleted-payment-commission.job";
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

type BonusSkipReason = "bonus_disabled" | "bonus_below_min_payment" | "bonus_cap_reached" | Extract<SkipReason, "nothing_left_to_grant">;

/** Read off the chain index before the payment row lock, so it names the bonus row it was read for in case another sync replaced that row since. */
type BonusUsage = { commissionId: string; hasConsumedMinimum: boolean; isWindowOpen: boolean };

type LaneSync = { lane: AffiliateCommissionLane; releaseCredit?: PaymentCreditOutput; bonusUsage?: BonusUsage };

type ReversalReason = "dispute_lost" | "dispute_funds_withdrawn" | "refund";

type Reversal = { commission: StripeTransactionOutput & { userId: string }; amountCents: number; totalReversedCents: number; shortfallCents: number };

const UNCREDITED_COMMISSION_STATUSES = new Set<StripeTransactionOutput["status"]>(["pending", "canceled"]);

const COMMISSION_LANE: AffiliateCommissionLane = { bonus: false };

const BONUS_LANE: AffiliateCommissionLane = { bonus: true };

const BONUS_RELEASE_TRIGGERS = new Set<AffiliateCommissionSyncTrigger>(["release", "dispute", "bonus_usage"]);

@singleton()
export class AffiliateCommissionService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly stripeTransactionRepository: StripeTransactionRepository,
    private readonly referralRepository: ReferralRepository,
    private readonly affiliateRepository: AffiliateRepository,
    private readonly paymentMethodRepository: PaymentMethodRepository,
    private readonly paymentCreditRepository: PaymentCreditRepository,
    private readonly paymentCreditService: PaymentCreditService,
    private readonly organizationRepository: OrganizationRepository,
    private readonly userRepository: UserRepository,
    private readonly personalOrganizationService: PersonalOrganizationService,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly refillService: RefillService,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly analyticsService: AnalyticsService,
    private readonly txService: TxService,
    private readonly jobQueueService: JobQueueService,
    private readonly referredUsageService: ReferredUsageService,
    @InjectBillingConfig() private readonly billingConfig: BillingConfig,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: AffiliateCommissionService.name });
  }

  /** Holds the payment row lock until commit, so syncs of one payment run in turn and each sees the commission the previous one recorded. */
  async syncCommission(transactionId: string, trigger: AffiliateCommissionSyncTrigger): Promise<void> {
    if (trigger === "settlement" && !(await this.#isCreditLanded(transactionId))) return this.#skip(transactionId, "credit_not_landed");
    const laneSyncs = await this.#readLanesBeforeLock(transactionId, trigger);

    await this.txService.transaction(async () => {
      const payment = await this.stripeTransactionRepository.findOneByAndLock({ id: transactionId });
      if (!payment || payment.type !== "payment_intent" || !SETTLED_TRANSACTION_STATUSES.has(payment.status)) return;

      for (const laneSync of laneSyncs) {
        await this.#syncLane(payment, trigger, laneSync);
      }
    });
  }

  /** The bonus row lives next to the commission row of the same payment and runs through the same states, so each sync walks both unless it concerns one alone. */
  async #readLanesBeforeLock(transactionId: string, trigger: AffiliateCommissionSyncTrigger): Promise<LaneSync[]> {
    if (trigger === "settlement") return [{ lane: COMMISSION_LANE }];
    if (trigger === "bonus_usage") return [await this.#readLaneBeforeLock(transactionId, BONUS_LANE, trigger)];

    return [await this.#readLaneBeforeLock(transactionId, COMMISSION_LANE, trigger), await this.#readLaneBeforeLock(transactionId, BONUS_LANE, trigger)];
  }

  async #readLaneBeforeLock(transactionId: string, lane: AffiliateCommissionLane, trigger: AffiliateCommissionSyncTrigger): Promise<LaneSync> {
    const commission = await this.stripeTransactionRepository.findAffiliateCommissionBySource(transactionId, lane);
    if (!commission) return { lane };

    const releaseCredit = await this.#findReleaseCredit(commission);
    const canReleaseBonus = commission.affiliateBonus && commission.status === "pending" && BONUS_RELEASE_TRIGGERS.has(trigger);

    return { lane, releaseCredit, bonusUsage: canReleaseBonus ? await this.#readBonusUsage(transactionId, commission) : undefined };
  }

  async #syncLane(payment: StripeTransactionOutput, trigger: AffiliateCommissionSyncTrigger, { lane, releaseCredit, bonusUsage }: LaneSync): Promise<void> {
    const commission = await this.stripeTransactionRepository.findAffiliateCommissionBySourceAndLock(payment.id, lane);
    if (!commission) {
      if (trigger === "settlement") await this.#hold(payment);
    } else if (releaseCredit?.transactionId === commission.id && UNCREDITED_COMMISSION_STATUSES.has(commission.status)) {
      await this.#reconcileReversal(payment, await this.#recordLandedRelease(commission, releaseCredit, trigger));
    } else if (commission.status === "pending") {
      await (this.#isReleaseDue(payment, commission, trigger)
        ? this.#releaseInLane(payment, commission, bonusUsage)
        : this.#reconcileHeld(payment, commission));
    } else {
      await this.#reconcileReversal(payment, commission);
    }
  }

  async #releaseInLane(payment: StripeTransactionOutput, commission: StripeTransactionOutput, bonusUsage: BonusUsage | undefined): Promise<void> {
    await (commission.affiliateBonus ? this.#releaseBonus(payment, commission, bonusUsage) : this.#release(payment, commission));
  }

  /** A payment row goes with its payer's account, so the charge is all that still tells what the payer paid on it. */
  async reverseCommissionsOfDeletedPayment(stripeChargeId: string, reversal: DeletedPaymentReversal): Promise<void> {
    const releaseCredits = await this.#findReleaseCreditsOfDeletedPayment(stripeChargeId);

    await this.txService.transaction(async () => {
      const commissions = await this.stripeTransactionRepository.findAffiliateCommissionsOfDeletedPaymentAndLock(stripeChargeId);

      for (const commission of commissions) {
        await this.#reverseCommissionOfDeletedPayment(commission, releaseCredits.get(commission.id), reversal);
      }
    });
  }

  /** Reads before taking the commission row locks, like `#findReleaseCredit`, so a credit only counts for a commission that is still uncredited once locked. */
  async #findReleaseCreditsOfDeletedPayment(stripeChargeId: string): Promise<Map<string, PaymentCreditOutput>> {
    const commissions = await this.stripeTransactionRepository.find({
      type: "affiliate_commission",
      sourceStripeChargeId: stripeChargeId,
      sourceTransactionId: null
    });
    const releaseCredits = new Map<string, PaymentCreditOutput>();

    for (const commission of commissions) {
      const releaseCredit = await this.#findSettledReleaseCredit(commission.id);
      if (releaseCredit) releaseCredits.set(commission.id, releaseCredit);
    }

    return releaseCredits;
  }

  /** No release retries once the payment is gone, so a credit a failed release left pending is settled here, and throws while its outcome is still unknown. */
  async #findSettledReleaseCredit(commissionId: string): Promise<PaymentCreditOutput | undefined> {
    const hasLanded = await this.paymentCreditService.hasLanded(commissionId);
    return hasLanded ? this.paymentCreditRepository.findByTransactionId(commissionId) : undefined;
  }

  async #reverseCommissionOfDeletedPayment(
    commission: StripeTransactionOutput,
    releaseCredit: PaymentCreditOutput | undefined,
    reversal: DeletedPaymentReversal
  ): Promise<void> {
    const keptAmount = reversal.reason === "dispute_lost" ? 0 : this.#shareStillPaid(commission.amount, reversal);

    if (releaseCredit && UNCREDITED_COMMISSION_STATUSES.has(commission.status)) {
      return this.#takeBackCredited(await this.#recordLandedRelease(commission, releaseCredit, reversal.reason), keptAmount, reversal.reason);
    }

    await (commission.status === "pending"
      ? this.#shrinkHeld(commission, keptAmount, reversal.reason)
      : this.#takeBackCredited(commission, keptAmount, reversal.reason));
  }

  async #takeBackCredited(commission: StripeTransactionOutput, keptAmount: number, reason: ReversalReason): Promise<void> {
    const reversal = await this.#takeBack(commission, keptAmount);
    if (reversal) this.#reportReversal(reversal, { reason, referredUserId: null });
  }

  /** Reads before taking the payment row lock, because the credit repository takes its own pool connection and syncs queued on that lock each hold one. */
  async #isCreditLanded(transactionId: string): Promise<boolean> {
    const credit = await this.paymentCreditRepository.findByTransactionId(transactionId);
    return credit?.status === "landed";
  }

  /** Reads before taking the payment row lock, like `#isCreditLanded`, so the credit may belong to a commission another sync has replaced by the time the lock is held. */
  async #findReleaseCredit(commission: StripeTransactionOutput): Promise<PaymentCreditOutput | undefined> {
    return await this.paymentCreditRepository.findByTransactionId(commission.id);
  }

  /** Reads the chain index before taking the payment row lock, like `#isCreditLanded`, since syncs queued on that lock would each hold a connection while it runs. */
  async #readBonusUsage(transactionId: string, bonus: StripeTransactionOutput): Promise<BonusUsage> {
    const payment = await this.stripeTransactionRepository.findById(transactionId);
    const referredUserId = payment && (await this.#findReferredUserId(payment));
    const attribution = referredUserId ? await this.referralRepository.findWithAffiliateByReferredUserId(referredUserId) : undefined;
    if (!referredUserId || !attribution) return { commissionId: bonus.id, hasConsumedMinimum: false, isWindowOpen: false };

    const referredAt = new Date(attribution.referral.createdAt);

    return {
      commissionId: bonus.id,
      hasConsumedMinimum: await this.referredUsageService.hasConsumedAtLeast(referredUserId, referredAt, this.#bonusUsageThreshold(attribution.referral)),
      isWindowOpen: isBefore(new Date(), addMonths(referredAt, AFFILIATE_COMMISSION_MONTHS))
    };
  }

  /** The trial credit the referral granted pays for usage too, so only usage beyond it shows the referred user paid to deploy. */
  #bonusUsageThreshold(referral: ReferralWithAffiliate["referral"]): number {
    return this.billingConfig.AFFILIATE_FIRST_PURCHASE_BONUS_MIN_USAGE_AMOUNT + (referral.trialCreditsCents ?? 0);
  }

  /** A release whose credit landed on its own connection before its transaction rolled back leaves the row pending, or canceled by a refund that read no credit yet, so the row is recorded as credited before any refund is taken back from it. */
  async #recordLandedRelease(
    commission: StripeTransactionOutput,
    credit: PaymentCreditOutput,
    trigger: AffiliateCommissionSyncTrigger | DeletedPaymentReversal["reason"]
  ): Promise<StripeTransactionOutput> {
    if (credit.status !== "landed") throw new Error(`The release credit of affiliate commission ${commission.id} is still in flight`);

    const credited = { ...commission, status: "succeeded" as const, amountRefunded: commission.amount - credit.amount };
    await this.stripeTransactionRepository.updateById(commission.id, { status: credited.status, amountRefunded: credited.amountRefunded });
    this.#logger.warn({
      event: "AFFILIATE_COMMISSION_RELEASE_RECOVERED",
      commissionId: commission.id,
      sourceTransactionId: commission.sourceTransactionId,
      amountCents: credit.amount,
      trigger
    });

    return credited;
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

    const organizationId = await this.#findPersonalOrganizationId(affiliate.userId);
    await this.affiliateRepository.lockById(affiliate.id);
    const referral = await this.referralRepository.findByIdFresh(attribution.referral.id);

    const commission = await this.#recordCommission({
      userId: affiliate.userId,
      organizationId,
      amount,
      amountRefunded: amount - keptAmount,
      sourceTransactionId: payment.id,
      sourceStripeChargeId: payment.stripeChargeId
    });
    if (!commission) return;

    const releasesAt = this.#releasesAt(commission);
    await this.jobQueueService.enqueue(new SyncAffiliateCommission({ transactionId: payment.id, trigger: "release" }), { startAfter: releasesAt });

    if (referral?.firstCommissionAt === null && (await this.referralRepository.markFirstCommission(referral.id, new Date()))) {
      await this.#grantBonus(payment, { affiliateUserId: affiliate.userId, organizationId, referredUserId });
    }

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

  /** Runs under the affiliate row lock `#hold` takes, so two payments of one referral cannot both be first and the monthly cap counts every bonus granted before it. */
  async #grantBonus(
    payment: StripeTransactionOutput,
    { affiliateUserId, organizationId, referredUserId }: { affiliateUserId: string; organizationId: string; referredUserId: string }
  ): Promise<void> {
    const amount = this.billingConfig.AFFILIATE_FIRST_PURCHASE_BONUS_AMOUNT;
    const keptAmount = this.#keptCommission(amount, payment);
    const skipReason = await this.#findBonusSkipReason(payment, affiliateUserId, { amount, keptAmount });
    if (skipReason) {
      this.#logger.info({ event: "AFFILIATE_BONUS_SKIPPED", transactionId: payment.id, affiliateUserId, reason: skipReason });
      return;
    }

    const bonus = await this.#recordCommission({
      userId: affiliateUserId,
      organizationId,
      amount,
      amountRefunded: amount - keptAmount,
      sourceTransactionId: payment.id,
      sourceStripeChargeId: payment.stripeChargeId,
      affiliateBonus: true
    });
    if (!bonus) return;

    const releasesAt = this.#releasesAt(bonus);
    this.analyticsService.track(affiliateUserId, "affiliate_bonus_held", {
      bonus_cents: keptAmount,
      source_transaction_id: payment.id,
      referred_user_id: referredUserId,
      releases_at: releasesAt.toISOString()
    });
    this.#logger.info({
      event: "AFFILIATE_BONUS_HELD",
      commissionId: bonus.id,
      affiliateUserId,
      sourceTransactionId: payment.id,
      amountCents: keptAmount,
      grossAmountCents: amount,
      releasesAt
    });
  }

  async #findBonusSkipReason(
    payment: StripeTransactionOutput,
    affiliateUserId: string,
    { amount, keptAmount }: { amount: number; keptAmount: number }
  ): Promise<BonusSkipReason | undefined> {
    if (amount <= 0) return "bonus_disabled";
    if (payment.amount < this.billingConfig.AFFILIATE_FIRST_PURCHASE_BONUS_MIN_PAYMENT_AMOUNT) return "bonus_below_min_payment";

    const bonusesThisMonth = await this.stripeTransactionRepository.countAffiliateBonusesSince(affiliateUserId, startOfUtcMonth(new Date()));
    if (bonusesThisMonth >= this.billingConfig.AFFILIATE_FIRST_PURCHASE_BONUS_MONTHLY_CAP) return "bonus_cap_reached";
    if (keptAmount <= 0) return "nothing_left_to_grant";

    return undefined;
  }

  /** A usage read that no longer names the locked row says nothing about it, so the release waits for a fresh read rather than cancel on a stale one. */
  async #releaseBonus(payment: StripeTransactionOutput, bonus: StripeTransactionOutput, usage: BonusUsage | undefined): Promise<void> {
    if (usage?.commissionId !== bonus.id) return this.#deferBonusRelease(payment, bonus, "usage_unchecked");
    if (usage.hasConsumedMinimum) return this.#release(payment, bonus);
    if (usage.isWindowOpen) return this.#deferBonusRelease(payment, bonus, "usage_below_minimum");

    await this.#cancel(bonus, "bonus_usage_not_met");
  }

  async #deferBonusRelease(payment: StripeTransactionOutput, bonus: StripeTransactionOutput, reason: "usage_unchecked" | "usage_below_minimum"): Promise<void> {
    const recheckAt = addDays(new Date(), 1);
    await this.jobQueueService.enqueue(new SyncAffiliateCommission({ transactionId: payment.id, trigger: "bonus_usage" }), { startAfter: recheckAt });

    this.#logger.info({
      event: "AFFILIATE_BONUS_RELEASE_DEFERRED",
      commissionId: bonus.id,
      sourceTransactionId: payment.id,
      reason,
      recheckAt
    });
  }

  #releasesAt(commission: StripeTransactionOutput): Date {
    return addSeconds(commission.createdAt, this.billingConfig.AFFILIATE_COMMISSION_HOLD_SECONDS);
  }

  /** A dispute settled in Console's favour after the hold ended has no scheduled release left to wait for. */
  #isReleaseDue(payment: StripeTransactionOutput, commission: StripeTransactionOutput, trigger: AffiliateCommissionSyncTrigger): boolean {
    if (trigger === "release" || trigger === "bonus_usage") return true;
    if (trigger !== "dispute" || payment.disputeLostAt) return false;

    return !isAfter(this.#releasesAt(commission), new Date());
  }

  #hasOpenDispute(payment: StripeTransactionOutput): boolean {
    return this.#isSinceLastDisputeClose(payment.disputeOpenedAt, payment) || this.#hasWithdrawnDisputeFunds(payment);
  }

  /** A dispute closed in Console's favour returns the withdrawn funds, so a withdrawal counts only until the close that follows it. */
  #hasWithdrawnDisputeFunds(payment: StripeTransactionOutput): boolean {
    return this.#isSinceLastDisputeClose(payment.disputeFundsWithdrawnAt, payment);
  }

  #isSinceLastDisputeClose(disputeEventAt: Date | null, payment: StripeTransactionOutput): boolean {
    if (!disputeEventAt) return false;

    return !payment.disputeClosedAt || isAfter(disputeEventAt, payment.disputeClosedAt);
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
    if (cancelReason) return this.#cancel(commission, cancelReason);

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
    if (await this.#isWalletAbuseLockedAtCredit(affiliateUserId)) return "affiliate_abuse_locked";
    if (releasedAmount <= 0) return "nothing_left_to_grant";

    return undefined;
  }

  /** Holds the wallet row the credit also takes, so the wallet cannot change between this read and the credit. */
  async #isWalletAbuseLockedAtCredit(userId: string): Promise<boolean> {
    const wallet = await this.userWalletRepository.findOneByAndLock({ userId });
    return !!wallet?.abuseLockedAt;
  }

  async #cancel(commission: StripeTransactionOutput, reason: CancelReason | "refund" | "dispute_lost" | "bonus_usage_not_met"): Promise<void> {
    await this.stripeTransactionRepository.updateById(commission.id, { status: "canceled", amountRefunded: commission.amount });

    if (commission.userId) {
      this.analyticsService.track(commission.userId, "affiliate_commission_canceled", {
        amount_cents: commission.amount - commission.amountRefunded,
        source_transaction_id: commission.sourceTransactionId,
        reason
      });
    }
    this.#logger.info({ event: "AFFILIATE_COMMISSION_CANCELED", commissionId: commission.id, sourceTransactionId: commission.sourceTransactionId, reason });
  }

  async #reconcileHeld(payment: StripeTransactionOutput, commission: StripeTransactionOutput): Promise<void> {
    await this.#shrinkHeld(commission, this.#keptCommission(commission.amount, payment), payment.disputeLostAt ? "dispute_lost" : "refund");
  }

  /** A held commission was never credited, so a refund only shrinks what the release will credit, and a full one cancels it. */
  async #shrinkHeld(commission: StripeTransactionOutput, keptOfWholeCommission: number, reason: "refund" | "dispute_lost"): Promise<void> {
    const keptAmount = Math.min(commission.amount - commission.amountRefunded, keptOfWholeCommission);

    if (keptAmount <= 0) return this.#cancel(commission, reason);

    const amountRefunded = commission.amount - keptAmount;
    if (amountRefunded === commission.amountRefunded) return;

    await this.stripeTransactionRepository.updateById(commission.id, { amountRefunded });
    this.#logger.info({
      event: "AFFILIATE_COMMISSION_HOLD_REDUCED",
      commissionId: commission.id,
      sourceTransactionId: commission.sourceTransactionId,
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

  /** An affiliate who has not signed in since organizations launched has no personal organization until one is provisioned. */
  async #findPersonalOrganizationId(userId: string): Promise<string> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new Error(`Affiliate ${userId} has no user account to file the commission for`);

    return (await this.personalOrganizationService.ensureForUser(user)).id;
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
    organizationId: string;
    amount: number;
    amountRefunded: number;
    sourceTransactionId: string;
    sourceStripeChargeId: string | null;
    createdAt?: Date;
    affiliateBonus?: boolean;
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
    const hasWithdrawnDisputeFunds = this.#hasWithdrawnDisputeFunds(payment);
    const reversal = await this.#takeBack(commission, hasWithdrawnDisputeFunds ? 0 : this.#keptCommission(commission.amount, payment));
    if (!reversal) return;

    if (hasWithdrawnDisputeFunds) await this.#holdUntilDisputeIsDecided(payment, reversal.commission, reversal.amountCents - reversal.shortfallCents);

    this.#reportReversal(reversal, { reason: this.#findReversalReason(payment), referredUserId: await this.#findReferredUserId(payment) });
  }

  async #takeBack(commission: StripeTransactionOutput, keptAmount: number): Promise<Reversal | undefined> {
    const totalReversedCents = Math.min(commission.amount, Math.max(commission.amountRefunded, commission.amount - keptAmount));
    const amountCents = totalReversedCents - commission.amountRefunded;
    const affiliateUserId = commission.userId;
    if (amountCents <= 0 || !affiliateUserId) return undefined;

    await this.stripeTransactionRepository.updateById(commission.id, {
      amountRefunded: totalReversedCents,
      ...(totalReversedCents >= commission.amount ? { status: "refunded" } : {})
    });
    const { shortfallCents } = await this.refillService.reduceWalletBalance(
      amountCents,
      { userId: affiliateUserId, organizationId: commission.organizationId },
      { currency: "usd", transactionId: commission.id, refundedBefore: commission.amountRefunded, refundedAfter: totalReversedCents }
    );

    return { commission: { ...commission, userId: affiliateUserId }, amountCents, totalReversedCents, shortfallCents };
  }

  #reportReversal(
    { commission, amountCents, totalReversedCents, shortfallCents }: Reversal,
    { reason, referredUserId }: { reason: ReversalReason; referredUserId: string | null }
  ): void {
    this.analyticsService.track(commission.userId, "affiliate_commission_reversed", {
      amount_cents: amountCents,
      source_transaction_id: commission.sourceTransactionId,
      referred_user_id: referredUserId,
      reason
    });
    this.#logger.info({
      event: "AFFILIATE_COMMISSION_REVERSED",
      commissionId: commission.id,
      affiliateUserId: commission.userId,
      sourceTransactionId: commission.sourceTransactionId,
      amountCents,
      totalReversedCents,
      shortfallCents,
      reason
    });
  }

  #findReversalReason(payment: StripeTransactionOutput): ReversalReason {
    if (payment.disputeLostAt) return "dispute_lost";

    return this.#hasWithdrawnDisputeFunds(payment) ? "dispute_funds_withdrawn" : "refund";
  }

  /** Holds what was taken back as a new commission dated like the reversed one, whose hold is already over, so the close of the dispute alone credits it again or cancels it. */
  async #holdUntilDisputeIsDecided(
    payment: StripeTransactionOutput,
    reversed: StripeTransactionOutput & { userId: string },
    takenBackAmount: number
  ): Promise<void> {
    if (takenBackAmount <= 0) return;

    const held = await this.#recordCommission({
      userId: reversed.userId,
      organizationId: reversed.organizationId,
      amount: reversed.amount,
      amountRefunded: reversed.amount - takenBackAmount,
      sourceTransactionId: payment.id,
      sourceStripeChargeId: payment.stripeChargeId,
      createdAt: reversed.createdAt,
      affiliateBonus: reversed.affiliateBonus
    });
    if (!held) return;

    this.#logger.info({
      event: "AFFILIATE_COMMISSION_HELD_FOR_DISPUTE",
      commissionId: held.id,
      reversedCommissionId: reversed.id,
      affiliateUserId: reversed.userId,
      sourceTransactionId: payment.id,
      amountCents: takenBackAmount
    });
  }

  /** Scales the commission by the share of the payment the payer still paid, so a refund never takes back more than its share whatever rate the commission was granted at. */
  #keptCommission(commissionAmount: number, payment: StripeTransactionOutput): number {
    return payment.disputeLostAt ? 0 : this.#shareStillPaid(commissionAmount, payment);
  }

  #shareStillPaid(commissionAmount: number, paid: { amount: number; amountRefunded: number }): number {
    return Math.floor((commissionAmount * (paid.amount - paid.amountRefunded)) / paid.amount);
  }

  #skip(transactionId: string, reason: SkipReason): void {
    this.#logger.debug({ event: "AFFILIATE_COMMISSION_SKIPPED", transactionId, reason });
  }
}

/** Caps count calendar months in UTC, whatever zone the process runs in. */
function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}
