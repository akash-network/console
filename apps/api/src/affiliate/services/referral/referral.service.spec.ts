import type { CreateLogger } from "@akashnetwork/logging";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ReferralRepository } from "@src/affiliate/repositories/referral/referral.repository";
import type { AffiliateService } from "@src/affiliate/services/affiliate/affiliate.service";
import type { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { ReferralService } from "./referral.service";

import { createAffiliate } from "@test/seeders/affiliate.seeder";
import { createReferral } from "@test/seeders/referral.seeder";

describe(ReferralService.name, () => {
  describe("attribute", () => {
    it("checks the affiliate program flag for the affiliate who owns the code", async () => {
      const affiliate = createAffiliate({ code: "friendcode" });
      const { service, affiliateService, featureFlagsService } = setup();
      affiliateService.findActiveByCode.mockResolvedValue(affiliate);

      await service.attribute({ referredUserId: "referred-user-id", code: "friendcode" });

      expect(featureFlagsService.isEnabled).toHaveBeenCalledWith(FeatureFlags.AFFILIATE_PROGRAM, { userId: affiliate.userId });
    });

    it("logs REFERRAL_CODE_IGNORED and inserts nothing when the affiliate program flag is off for the affiliate", async () => {
      const affiliate = createAffiliate({ code: "friendcode" });
      const { service, affiliateService, referralRepository, analyticsService, featureFlagsService, logger } = setup();
      affiliateService.findActiveByCode.mockResolvedValue(affiliate);
      featureFlagsService.isEnabled.mockReturnValue(false);

      await service.attribute({ referredUserId: "referred-user-id", code: "friendcode" });

      expect(referralRepository.createIfAbsent).not.toHaveBeenCalled();
      expect(analyticsService.track).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith({ event: "REFERRAL_CODE_IGNORED", code: "friendcode", reason: "program_disabled" });
    });

    it("logs REFERRAL_CODE_IGNORED and inserts nothing for an unknown, malformed or revoked code", async () => {
      const { service, affiliateService, referralRepository, logger } = setup();
      affiliateService.findActiveByCode.mockResolvedValue(undefined);

      await service.attribute({ referredUserId: "referred-user-id", code: "bad-code" });

      expect(referralRepository.createIfAbsent).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith({ event: "REFERRAL_CODE_IGNORED", code: "bad-code", reason: "unknown_or_revoked" });
    });

    it("logs REFERRAL_CODE_IGNORED and inserts nothing when the referred user is the affiliate themself", async () => {
      const affiliate = createAffiliate({ userId: "referred-user-id" });
      const { service, affiliateService, referralRepository, logger } = setup();
      affiliateService.findActiveByCode.mockResolvedValue(affiliate);

      await service.attribute({ referredUserId: "referred-user-id", code: affiliate.code });

      expect(referralRepository.createIfAbsent).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith({ event: "REFERRAL_CODE_IGNORED", code: affiliate.code, reason: "self_referral" });
    });

    it("creates the referral, tracks referral_signup and logs REFERRAL_ATTRIBUTED for a valid code", async () => {
      const affiliate = createAffiliate({ code: "friendcode" });
      const referral = createReferral({ referredUserId: "referred-user-id", affiliateId: affiliate.id });
      const { service, affiliateService, referralRepository, analyticsService, logger } = setup();
      affiliateService.findActiveByCode.mockResolvedValue(affiliate);
      referralRepository.createIfAbsent.mockResolvedValue(referral);

      await service.attribute({ referredUserId: "referred-user-id", code: "friendcode" });

      expect(referralRepository.createIfAbsent).toHaveBeenCalledWith({ referredUserId: "referred-user-id", affiliateId: affiliate.id });
      expect(analyticsService.track).toHaveBeenCalledWith("referred-user-id", "referral_signup", {
        affiliate_id: affiliate.id,
        affiliate_code: affiliate.code
      });
      expect(logger.info).toHaveBeenCalledWith({
        event: "REFERRAL_ATTRIBUTED",
        referredUserId: "referred-user-id",
        affiliateId: affiliate.id,
        code: affiliate.code
      });
    });

    it("does not track or log attribution when the user was already referred", async () => {
      const affiliate = createAffiliate({ code: "friendcode" });
      const { service, affiliateService, referralRepository, analyticsService, logger } = setup();
      affiliateService.findActiveByCode.mockResolvedValue(affiliate);
      referralRepository.createIfAbsent.mockResolvedValue(undefined);

      await service.attribute({ referredUserId: "referred-user-id", code: "friendcode" });

      expect(analyticsService.track).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
    });
  });

  it("creates the logger with the service context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: ReferralService.name });
  });

  function setup() {
    const referralRepository = mock<ReferralRepository>();
    const affiliateService = mock<AffiliateService>();
    const analyticsService = mock<AnalyticsService>();
    const featureFlagsService = mock<FeatureFlagsService>();
    featureFlagsService.isEnabled.mockReturnValue(true);
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const service = new ReferralService(referralRepository, affiliateService, analyticsService, featureFlagsService, createLogger);

    return { service, referralRepository, affiliateService, analyticsService, featureFlagsService, logger, createLogger };
  }
});
