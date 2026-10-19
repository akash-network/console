import { inject, singleton } from "tsyringe";

import { ReferralRepository } from "@src/affiliate/repositories/referral/referral.repository";
import { AffiliateService } from "@src/affiliate/services/affiliate/affiliate.service";
import { type BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";

const MICRO_DENOM_PER_UNIT = 1_000_000;
const CENTS_PER_DOLLAR = 100;

export type AttributeReferralInput = { referredUserId: string; code: string };
export type Referral = { trialCreditsUsd: number };

@singleton()
export class ReferralService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly referralRepository: ReferralRepository,
    private readonly affiliateService: AffiliateService,
    private readonly analyticsService: AnalyticsService,
    private readonly featureFlagsService: FeatureFlagsService,
    @InjectBillingConfig() private readonly billingConfig: BillingConfig,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: ReferralService.name });
  }

  async attribute({ referredUserId, code }: AttributeReferralInput): Promise<void> {
    const affiliate = await this.affiliateService.findActiveByCode(code);
    if (!affiliate) {
      this.logger.debug({ event: "REFERRAL_CODE_IGNORED", code, reason: "unknown_or_revoked" });
      return;
    }

    if (!this.featureFlagsService.isEnabled(FeatureFlags.AFFILIATE_PROGRAM, { userId: affiliate.userId })) {
      this.logger.debug({ event: "REFERRAL_CODE_IGNORED", code, reason: "program_disabled" });
      return;
    }

    if (affiliate.userId === referredUserId) {
      this.logger.debug({ event: "REFERRAL_CODE_IGNORED", code, reason: "self_referral" });
      return;
    }

    const referral = await this.referralRepository.createIfAbsent({ referredUserId, affiliateId: affiliate.id });
    if (!referral) return;

    this.analyticsService.track(referredUserId, "referral_signup", { affiliate_id: affiliate.id, affiliate_code: affiliate.code });
    this.logger.info({ event: "REFERRAL_ATTRIBUTED", referredUserId, affiliateId: affiliate.id, code: affiliate.code });
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

  async getReferral(userId: string): Promise<Referral | null> {
    const referral = await this.referralRepository.findByReferredUserId(userId);
    if (!referral) return null;

    const trialCreditsUsd =
      referral.trialCreditsCents != null
        ? referral.trialCreditsCents / CENTS_PER_DOLLAR
        : this.billingConfig.REFERRAL_TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT / MICRO_DENOM_PER_UNIT;

    return { trialCreditsUsd };
  }
}
