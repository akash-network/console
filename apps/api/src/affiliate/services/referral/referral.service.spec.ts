import type { CreateLogger } from "@akashnetwork/logging";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ReferralRepository } from "@src/affiliate/repositories/referral/referral.repository";
import type { AffiliateService } from "@src/affiliate/services/affiliate/affiliate.service";
import type { BillingConfig } from "@src/billing/providers";
import type { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { ReferralService } from "./referral.service";

import { createAffiliate } from "@test/seeders/affiliate.seeder";
import { createReferral } from "@test/seeders/referral.seeder";

describe(ReferralService.name, () => {
  describe("attribute", () => {
    it("does nothing when the affiliate program flag is off", async () => {
      const { service, affiliateService, referralRepository, featureFlagsService } = setup();
      featureFlagsService.isEnabled.mockReturnValue(false);

      await service.attribute({ referredUserId: "referred-user-id", code: "friendcode" });

      expect(affiliateService.findActiveByCode).not.toHaveBeenCalled();
      expect(referralRepository.createIfAbsent).not.toHaveBeenCalled();
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

  describe("getTrialDeploymentLimit", () => {
    it("returns the referral trial deployment allowance when the user was referred", async () => {
      const referral = createReferral({ referredUserId: "referred-user-id" });
      const { service, referralRepository, billingConfig } = setup();
      referralRepository.findByReferredUserId.mockResolvedValue(referral);

      const result = await service.getTrialDeploymentLimit("referred-user-id");

      expect(result).toBe(billingConfig.REFERRAL_TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT);
    });

    it("returns undefined when the user was never referred", async () => {
      const { service, referralRepository } = setup();
      referralRepository.findByReferredUserId.mockResolvedValue(undefined);

      const result = await service.getTrialDeploymentLimit("not-referred-user-id");

      expect(result).toBeUndefined();
    });
  });

  describe("recordTrialGranted", () => {
    it("records the granted deployment limit as trial credit cents on the referral", async () => {
      const referral = createReferral({ referredUserId: "referred-user-id" });
      const { service, referralRepository } = setup();
      referralRepository.findByReferredUserId.mockResolvedValue(referral);

      await service.recordTrialGranted("referred-user-id", 5_000_000);

      expect(referralRepository.updateById).toHaveBeenCalledWith(referral.id, { trialCreditsCents: 500 });
    });

    it("does nothing when the user was never referred", async () => {
      const { service, referralRepository } = setup();
      referralRepository.findByReferredUserId.mockResolvedValue(undefined);

      await service.recordTrialGranted("not-referred-user-id", 5_000_000);

      expect(referralRepository.updateById).not.toHaveBeenCalled();
    });
  });

  describe("getReferral", () => {
    it("returns null when the user was never referred", async () => {
      const { service, referralRepository } = setup();
      referralRepository.findByReferredUserId.mockResolvedValue(undefined);

      const result = await service.getReferral("not-referred-user-id");

      expect(result).toBeNull();
    });

    it("returns the recorded trial credits in dollars once the trial was granted", async () => {
      const referral = createReferral({ referredUserId: "referred-user-id", trialCreditsCents: 500 });
      const { service, referralRepository } = setup();
      referralRepository.findByReferredUserId.mockResolvedValue(referral);

      const result = await service.getReferral("referred-user-id");

      expect(result).toEqual({ trialCreditsUsd: 5 });
    });

    it("falls back to the configured referral trial amount before the trial is granted", async () => {
      const referral = createReferral({ referredUserId: "referred-user-id", trialCreditsCents: null });
      const { service, referralRepository, billingConfig } = setup();
      referralRepository.findByReferredUserId.mockResolvedValue(referral);

      const result = await service.getReferral("referred-user-id");

      expect(result).toEqual({ trialCreditsUsd: billingConfig.REFERRAL_TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT / 1_000_000 });
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
    const billingConfig = mock<BillingConfig>({ REFERRAL_TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT: 5_000_000 });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const service = new ReferralService(referralRepository, affiliateService, analyticsService, featureFlagsService, billingConfig, createLogger);

    return { service, referralRepository, affiliateService, analyticsService, featureFlagsService, billingConfig, logger, createLogger };
  }
});
