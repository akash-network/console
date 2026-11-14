import { addMonths, differenceInMonths, isAfter } from "date-fns";
import createError from "http-errors";
import { createHash } from "node:crypto";
import { singleton } from "tsyringe";

import { AFFILIATE_COMMISSION_MONTHS } from "@src/affiliate/lib/affiliate-terms/affiliate-terms";
import { ReferralRepository, type ReferralSummary } from "@src/affiliate/repositories/referral/referral.repository";
import { AffiliateService } from "@src/affiliate/services/affiliate/affiliate.service";
import { getTrialEndsAt } from "@src/billing/lib/trial-window/trial-window";
import { type BillingConfig, InjectBillingConfig } from "@src/billing/providers";

const CENTS_PER_USD = 100;
const REFERRAL_CODE_LENGTH = 6;

export type ReferralStatus = "on_trial" | "paying" | "inactive";

export type AffiliateReferral = {
  code: string;
  joinedAt: string;
  status: ReferralStatus;
  commissionEndsAt: string;
  commissionMonthsLeft: number;
  paidUsd: number;
  earnedUsd: number;
};

export type AffiliateReferralPage = {
  referrals: AffiliateReferral[];
  pagination: { total: number; limit: number; offset: number };
};

@singleton()
export class AffiliateReferralService {
  constructor(
    private readonly affiliateService: AffiliateService,
    private readonly referralRepository: ReferralRepository,
    @InjectBillingConfig() private readonly billingConfig: BillingConfig
  ) {}

  async listReferrals(userId: string, { limit, offset }: { limit: number; offset: number }): Promise<AffiliateReferralPage> {
    const affiliate = await this.affiliateService.findActiveByUserId(userId);
    if (!affiliate) throw createError(404, "The caller is not an approved affiliate", { errorCode: "affiliate_not_found" });

    const [total, summaries] = await Promise.all([
      this.referralRepository.countByAffiliate(affiliate.id),
      this.referralRepository.findSummariesByAffiliate({ affiliateId: affiliate.id, affiliateUserId: affiliate.userId }, { limit, offset })
    ]);
    const now = new Date();

    return {
      referrals: summaries.map(summary => this.#toReferral(summary, now)),
      pagination: { total, limit, offset }
    };
  }

  #toReferral(summary: ReferralSummary, now: Date): AffiliateReferral {
    const commissionEndsAt = addMonths(summary.createdAt, AFFILIATE_COMMISSION_MONTHS);

    return {
      code: this.#codeOf(summary.id),
      joinedAt: summary.createdAt.toISOString(),
      status: this.#statusOf(summary, now),
      commissionEndsAt: commissionEndsAt.toISOString(),
      commissionMonthsLeft: this.#monthsLeft(commissionEndsAt, now),
      paidUsd: summary.paidCents / CENTS_PER_USD,
      earnedUsd: summary.earnedCents / CENTS_PER_USD
    };
  }

  #monthsLeft(commissionEndsAt: Date, now: Date): number {
    if (!isAfter(commissionEndsAt, now)) return 0;

    const wholeMonths = differenceInMonths(commissionEndsAt, now);
    return isAfter(commissionEndsAt, addMonths(now, wholeMonths)) ? wholeMonths + 1 : wholeMonths;
  }

  /** A one-way digest of the referral's own id, so a row stays recognizable without naming the person behind it. */
  #codeOf(referralId: string): string {
    return createHash("sha256").update(referralId).digest("hex").slice(0, REFERRAL_CODE_LENGTH).toUpperCase();
  }

  #statusOf({ hasPaid, wallet }: ReferralSummary, now: Date): ReferralStatus {
    if (hasPaid) return "paying";
    if (wallet?.isTrialing && isAfter(getTrialEndsAt(wallet, this.billingConfig.TRIAL_ALLOWANCE_EXPIRATION_DAYS), now)) return "on_trial";

    return "inactive";
  }
}
