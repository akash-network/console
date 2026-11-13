import { inject, singleton } from "tsyringe";

import { ReferralRepository } from "@src/affiliate/repositories/referral/referral.repository";
import { AffiliateService } from "@src/affiliate/services/affiliate/affiliate.service";
import { type BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { UserWalletRepository } from "@src/billing/repositories/user-wallet/user-wallet.repository";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { type UserOutput, UserRepository } from "@src/user/repositories/user/user.repository";
import { normalizeEmailAddress } from "@src/workload-abuse/lib/email-domain/email-domain";

const MICRO_DENOM_PER_UNIT = 1_000_000;
const CENTS_PER_DOLLAR = 100;

type ReferredUser = Pick<UserOutput, "id" | "email" | "lastFingerprint">;

export type AttributeReferralInput = { referredUser: ReferredUser; code: string };
export type Referral = { trialCreditsUsd: number };

@singleton()
export class ReferralService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly referralRepository: ReferralRepository,
    private readonly affiliateService: AffiliateService,
    private readonly analyticsService: AnalyticsService,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly userRepository: UserRepository,
    private readonly userWalletRepository: UserWalletRepository,
    @InjectBillingConfig() private readonly billingConfig: BillingConfig,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: ReferralService.name });
  }

  async attribute({ referredUser, code }: AttributeReferralInput): Promise<void> {
    const affiliate = await this.affiliateService.findActiveByCode(code);
    if (!affiliate) {
      this.logger.debug({ event: "REFERRAL_CODE_IGNORED", code, reason: "unknown_or_revoked" });
      return;
    }

    if (!this.featureFlagsService.isEnabled(FeatureFlags.AFFILIATE_PROGRAM, { userId: affiliate.userId })) {
      this.logger.debug({ event: "REFERRAL_CODE_IGNORED", code, reason: "program_disabled" });
      return;
    }

    if (affiliate.userId === referredUser.id) {
      this.logger.debug({ event: "REFERRAL_CODE_IGNORED", code, reason: "self_referral" });
      return;
    }

    if (await this.#isSameAccountHolderAs(affiliate.userId, referredUser)) {
      this.logger.info({ event: "REFERRAL_CODE_IGNORED", code, reason: "same_account_holder", referredUserId: referredUser.id, affiliateId: affiliate.id });
      return;
    }

    const referral = await this.referralRepository.createIfAbsent({ referredUserId: referredUser.id, affiliateId: affiliate.id });
    if (!referral) return;

    this.analyticsService.track(referredUser.id, "referral_signup", { affiliate_id: affiliate.id, affiliate_code: affiliate.code });
    this.logger.info({ event: "REFERRAL_ATTRIBUTED", referredUserId: referredUser.id, affiliateId: affiliate.id, code: affiliate.code });
  }

  async #isSameAccountHolderAs(affiliateUserId: string, referredUser: ReferredUser): Promise<boolean> {
    const affiliateUser = await this.userRepository.findById(affiliateUserId);
    if (!affiliateUser) return false;

    return (
      isPresentAndEqual(referredUser.lastFingerprint, affiliateUser.lastFingerprint) ||
      isPresentAndEqual(normalizeEmailAddress(referredUser.email), normalizeEmailAddress(affiliateUser.email))
    );
  }

  async getTrialDeploymentLimit(userId: string): Promise<number | undefined> {
    const referral = await this.referralRepository.findByReferredUserId(userId);
    return referral ? this.billingConfig.REFERRAL_TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT : undefined;
  }

  async recordTrialGranted(userId: string, deploymentLimit: number): Promise<void> {
    const referral = await this.referralRepository.findByReferredUserId(userId);
    if (!referral) return;

    await this.referralRepository.updateById(referral.id, { trialCreditsCents: Math.round(deploymentLimit / (MICRO_DENOM_PER_UNIT / CENTS_PER_DOLLAR)) });
  }

  /** Reads the wallet before the referral, since a trial grant commits both together and a referral read after it always shows what was granted. */
  async getReferral(userId: string): Promise<Referral | null> {
    const isTrialActivated = await this.#isTrialActivated(userId);
    const referral = await this.referralRepository.findByReferredUserId(userId);
    if (!referral) return null;
    if (referral.trialCreditsCents != null) return { trialCreditsUsd: referral.trialCreditsCents / CENTS_PER_DOLLAR };
    if (isTrialActivated) return null;

    return { trialCreditsUsd: this.billingConfig.REFERRAL_TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT / MICRO_DENOM_PER_UNIT };
  }

  async #isTrialActivated(userId: string): Promise<boolean> {
    const wallet = await this.userWalletRepository.unscoped("referral-trial").findOneByUserId(userId);
    return !!wallet?.activatedAt;
  }
}

function isPresentAndEqual(value: string | null | undefined, other: string | null | undefined): boolean {
  return !!value && value === other;
}
