import type { CreateLogger } from "@akashnetwork/logging";
import createError from "http-errors";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AffiliateRepository } from "@src/affiliate/repositories/affiliate/affiliate.repository";
import type { AffiliateProfile, AffiliateService } from "@src/affiliate/services/affiliate/affiliate.service";
import type { BillingConfig } from "@src/billing/providers";
import type { StripeTransactionRepository, UserWalletRepository } from "@src/billing/repositories";
import { FeatureFlags, type FeatureFlagValue } from "@src/core/services/feature-flags/feature-flags";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import { AffiliateEnrollmentService } from "./affiliate-enrollment.service";

import { createAffiliate } from "@test/seeders/affiliate.seeder";
import { createOrganization } from "@test/seeders/organization.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

describe(AffiliateEnrollmentService.name, () => {
  describe("checkEligibility", () => {
    it("is eligible when the user spent exactly the minimum", async () => {
      const { service } = setup({ spentCents: 10_000, minSpendCents: 10_000 });

      await expect(service.checkEligibility("user-1")).resolves.toEqual({ eligible: true });
    });

    it("is ineligible one cent below the minimum spend", async () => {
      const { service } = setup({ spentCents: 9_999, minSpendCents: 10_000 });

      await expect(service.checkEligibility("user-1")).resolves.toEqual({ eligible: false, reason: "below_min_spend" });
    });

    it("sums the spend of every organization the user created", async () => {
      const { service, organizationRepository, stripeTransactionRepository } = setup();
      const personal = createOrganization({ type: "personal", createdByUserId: "user-1" });
      const team = createOrganization({ type: "team", createdByUserId: "user-1" });
      organizationRepository.find.mockResolvedValue([personal, team]);

      await service.checkEligibility("user-1");

      expect(organizationRepository.find).toHaveBeenCalledWith({ createdByUserId: "user-1" });
      expect(stripeTransactionRepository.sumNetCardPaymentsByOrganizations).toHaveBeenCalledWith([personal.id, team.id]);
    });

    it("is ineligible when the program is off for the user, before any other check", async () => {
      const { service, featureFlagsService, affiliateRepository } = setup({
        disabledFlags: [FeatureFlags.AFFILIATE_PROGRAM, FeatureFlags.AFFILIATE_OPEN_ENROLLMENT]
      });

      await expect(service.checkEligibility("user-1")).resolves.toEqual({ eligible: false, reason: "program_disabled" });
      expect(featureFlagsService.isEnabledForSubject).toHaveBeenCalledWith(FeatureFlags.AFFILIATE_PROGRAM, "user-1");
      expect(affiliateRepository.findByUserId).not.toHaveBeenCalled();
    });

    it("is ineligible when open enrollment is off for the user", async () => {
      const { service, featureFlagsService, affiliateRepository } = setup({ disabledFlags: [FeatureFlags.AFFILIATE_OPEN_ENROLLMENT] });

      await expect(service.checkEligibility("user-1")).resolves.toEqual({ eligible: false, reason: "enrollment_disabled" });
      expect(featureFlagsService.isEnabledForSubject).toHaveBeenCalledWith(FeatureFlags.AFFILIATE_OPEN_ENROLLMENT, "user-1");
      expect(affiliateRepository.findByUserId).not.toHaveBeenCalled();
    });

    it("is ineligible when the user already is an active affiliate", async () => {
      const { service, affiliateRepository } = setup({ spentCents: 50_000, abuseLocked: true });
      affiliateRepository.findByUserId.mockResolvedValue(createAffiliate({ userId: "user-1", revokedAt: null }));

      await expect(service.checkEligibility("user-1")).resolves.toEqual({ eligible: false, reason: "already_affiliate" });
      expect(affiliateRepository.findByUserId).toHaveBeenCalledWith("user-1");
    });

    it("is ineligible when the user's affiliate profile was revoked", async () => {
      const { service, affiliateRepository } = setup({ spentCents: 50_000, abuseLocked: true });
      affiliateRepository.findByUserId.mockResolvedValue(createAffiliate({ userId: "user-1", revokedAt: new Date().toISOString() }));

      await expect(service.checkEligibility("user-1")).resolves.toEqual({ eligible: false, reason: "revoked" });
    });

    it("is ineligible when the user's wallet is abuse-locked, whichever organization is active", async () => {
      const { service, userWalletRepository, stripeTransactionRepository } = setup({ spentCents: 50_000, abuseLocked: true });

      await expect(service.checkEligibility("user-1")).resolves.toEqual({ eligible: false, reason: "abuse_locked" });
      expect(userWalletRepository.unscoped).toHaveBeenCalledWith("affiliate-enrollment");
      expect(userWalletRepository.findOneByUserId).toHaveBeenCalledWith("user-1");
      expect(stripeTransactionRepository.sumNetCardPaymentsByOrganizations).not.toHaveBeenCalled();
    });

    it("is eligible when the user has no wallet and spent enough", async () => {
      const { service, userWalletRepository } = setup({ spentCents: 50_000 });
      userWalletRepository.findOneByUserId.mockResolvedValue(undefined);

      await expect(service.checkEligibility("user-1")).resolves.toEqual({ eligible: true });
    });
  });

  describe("getEligibility", () => {
    it("returns the eligibility with the program terms", async () => {
      const { service } = setup({ spentCents: 10_000 });

      await expect(service.getEligibility("user-1")).resolves.toEqual({
        eligible: true,
        terms: {
          commissionPercent: 5,
          commissionMonths: 3,
          referralTrialCreditsUsd: 5,
          commissionHoldDays: 30,
          firstPurchaseBonusUsd: 5,
          firstPurchaseBonusMinPaymentUsd: 20,
          firstPurchaseBonusMinUsageUsd: 20
        }
      });
    });

    it("returns the terms without the reason when the user is ineligible, and logs the reason", async () => {
      const { service, logger } = setup({ spentCents: 0 });

      const result = await service.getEligibility("user-1");

      expect(result).toEqual({ eligible: false, terms: expect.objectContaining({ commissionPercent: 5 }) });
      expect(logger.debug).toHaveBeenCalledWith({ event: "AFFILIATE_ENROLLMENT_INELIGIBLE", userId: "user-1", reason: "below_min_spend" });
    });

    it("logs nothing when the user is eligible", async () => {
      const { service, logger } = setup({ spentCents: 10_000 });

      await service.getEligibility("user-1");

      expect(logger.debug).not.toHaveBeenCalled();
    });
  });

  describe("join", () => {
    it("approves an eligible user as a self-service affiliate and returns their profile", async () => {
      const { service, affiliateService, logger } = setup({ spentCents: 10_000 });
      const profile = mock<AffiliateProfile>({ code: "newcode" });
      affiliateService.getProfile.mockResolvedValueOnce(null).mockResolvedValueOnce(profile);
      affiliateService.enroll.mockResolvedValue(createAffiliate({ userId: "user-1", code: "newcode" }));

      await expect(service.join("user-1")).resolves.toBe(profile);
      expect(affiliateService.enroll).toHaveBeenCalledWith({ userId: "user-1", actor: "self-service" });
      expect(affiliateService.getProfile).toHaveBeenLastCalledWith("user-1");
      expect(logger.info).toHaveBeenCalledWith({ event: "AFFILIATE_SELF_JOINED", userId: "user-1", code: "newcode" });
    });

    it("returns the profile of a user who already is an active affiliate without approving again", async () => {
      const { service, affiliateService } = setup({ disabledFlags: [FeatureFlags.AFFILIATE_OPEN_ENROLLMENT] });
      const profile = mock<AffiliateProfile>({ code: "existing" });
      affiliateService.getProfile.mockResolvedValue(profile);

      await expect(service.join("user-1")).resolves.toBe(profile);
      expect(affiliateService.getProfile).toHaveBeenCalledWith("user-1");
      expect(affiliateService.enroll).not.toHaveBeenCalled();
    });

    it("refuses with 403 and logs the reason when the user is ineligible", async () => {
      const { service, affiliateService, logger } = setup({ spentCents: 9_999 });

      await expect(service.join("user-1")).rejects.toMatchObject({ status: 403, errorCode: "affiliate_enrollment_ineligible" });
      expect(affiliateService.enroll).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith({ event: "AFFILIATE_ENROLLMENT_INELIGIBLE", userId: "user-1", reason: "below_min_spend" });
    });

    it("returns the profile when a concurrent join approved the user first", async () => {
      const { service, affiliateService, logger } = setup({ spentCents: 10_000 });
      const profile = mock<AffiliateProfile>({ code: "racecode" });
      affiliateService.getProfile.mockResolvedValueOnce(null).mockResolvedValueOnce(profile);
      affiliateService.enroll.mockRejectedValue(createError(409, "This user is already an approved affiliate", { errorCode: "affiliate_already_approved" }));

      await expect(service.join("user-1")).resolves.toBe(profile);
      expect(logger.info).not.toHaveBeenCalledWith(expect.objectContaining({ event: "AFFILIATE_SELF_JOINED" }));
    });

    it("refuses with 403 when the affiliate a concurrent join created was revoked before this join enrolled", async () => {
      const { service, affiliateService } = setup({ spentCents: 10_000 });
      affiliateService.enroll.mockRejectedValue(createError(409, "This user is already an approved affiliate", { errorCode: "affiliate_already_approved" }));

      await expect(service.join("user-1")).rejects.toMatchObject({ status: 403, errorCode: "affiliate_enrollment_ineligible" });
    });

    it("returns the profile when a concurrent join inserted the affiliate between the profile read and the eligibility check", async () => {
      const { service, affiliateService, affiliateRepository, logger } = setup({ spentCents: 10_000 });
      const profile = mock<AffiliateProfile>({ code: "racecode" });
      affiliateService.getProfile.mockResolvedValueOnce(null).mockResolvedValueOnce(profile);
      affiliateRepository.findByUserId.mockResolvedValue(createAffiliate({ userId: "user-1", revokedAt: null }));

      await expect(service.join("user-1")).resolves.toBe(profile);
      expect(affiliateService.enroll).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalledWith(expect.objectContaining({ event: "AFFILIATE_ENROLLMENT_INELIGIBLE" }));
    });

    it("rethrows another conflict from the approval", async () => {
      const { service, affiliateService } = setup({ spentCents: 10_000 });
      const codeTaken = createError(409, "This code is already used by another affiliate", { errorCode: "affiliate_code_taken" });
      affiliateService.enroll.mockRejectedValue(codeTaken);

      await expect(service.join("user-1")).rejects.toBe(codeTaken);
    });

    it("rethrows a failure that is not an http error", async () => {
      const { service, affiliateService } = setup({ spentCents: 10_000 });
      const failure = new Error("connection lost");
      affiliateService.enroll.mockRejectedValue(failure);

      await expect(service.join("user-1")).rejects.toBe(failure);
    });

    it("refuses with 403 when the affiliate was revoked before their profile could be read", async () => {
      const { service, affiliateService } = setup({ spentCents: 10_000 });
      affiliateService.enroll.mockResolvedValue(createAffiliate({ userId: "user-1" }));

      await expect(service.join("user-1")).rejects.toMatchObject({ status: 403, errorCode: "affiliate_enrollment_ineligible" });
    });
  });

  function setup(input: { spentCents?: number; minSpendCents?: number; abuseLocked?: boolean; disabledFlags?: FeatureFlagValue[] } = {}) {
    const affiliateService = mock<AffiliateService>();
    affiliateService.getProfile.mockResolvedValue(null);
    const affiliateRepository = mock<AffiliateRepository>();
    affiliateRepository.findByUserId.mockResolvedValue(undefined);
    const organizationRepository = mock<OrganizationRepository>();
    organizationRepository.find.mockResolvedValue([createOrganization({ type: "personal", createdByUserId: "user-1" })]);
    const stripeTransactionRepository = mock<StripeTransactionRepository>();
    stripeTransactionRepository.sumNetCardPaymentsByOrganizations.mockResolvedValue(input.spentCents ?? 0);
    const userWalletRepository = mock<UserWalletRepository>();
    userWalletRepository.unscoped.mockReturnValue(userWalletRepository);
    userWalletRepository.findOneByUserId.mockResolvedValue(createUserWallet({ userId: "user-1", abuseLockedAt: input.abuseLocked ? new Date() : null }));
    const featureFlagsService = mock<FeatureFlagsService>();
    featureFlagsService.isEnabledForSubject.mockImplementation(flag => !input.disabledFlags?.includes(flag));
    const billingConfig = mock<BillingConfig>({
      AFFILIATE_SELF_JOIN_MIN_SPEND_AMOUNT: input.minSpendCents ?? 10_000,
      REFERRAL_TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT: 5_000_000,
      AFFILIATE_COMMISSION_HOLD_SECONDS: 2_592_000,
      AFFILIATE_FIRST_PURCHASE_BONUS_AMOUNT: 500,
      AFFILIATE_FIRST_PURCHASE_BONUS_MIN_PAYMENT_AMOUNT: 2000,
      AFFILIATE_FIRST_PURCHASE_BONUS_MIN_USAGE_AMOUNT: 2000
    });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const service = new AffiliateEnrollmentService(
      affiliateService,
      affiliateRepository,
      organizationRepository,
      stripeTransactionRepository,
      userWalletRepository,
      featureFlagsService,
      billingConfig,
      createLogger
    );

    return {
      service,
      affiliateService,
      affiliateRepository,
      organizationRepository,
      stripeTransactionRepository,
      userWalletRepository,
      featureFlagsService,
      billingConfig,
      logger,
      createLogger
    };
  }
});
