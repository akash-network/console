import { inject, singleton } from "tsyringe";

import { ReferralRepository } from "@src/affiliate/repositories/referral/referral.repository";
import { AffiliateService } from "@src/affiliate/services/affiliate/affiliate.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";

export type AttributeReferralInput = { referredUserId: string; code: string };

@singleton()
export class ReferralService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly referralRepository: ReferralRepository,
    private readonly affiliateService: AffiliateService,
    private readonly analyticsService: AnalyticsService,
    private readonly featureFlagsService: FeatureFlagsService,
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
}
