import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { StripeService } from "@src/billing/services/stripe/stripe.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { UserOutput, UserRepository } from "@src/user/repositories";
import type { BlockedEmailDomainService } from "@src/workload-abuse/services/blocked-email-domain/blocked-email-domain.service";
import type { TrialSignupHoldService } from "@src/workload-abuse/services/trial-signup-hold/trial-signup-hold.service";
import {
  EMAIL_VERIFICATION_REQUIRED_ERROR_CODE,
  TRIAL_BLOCKED_DOMAIN_MESSAGE,
  TRIAL_EMAIL_VERIFICATION_REQUIRED_MESSAGE,
  TRIAL_UNAVAILABLE_MESSAGE,
  TrialEligibilityService
} from "./trial-eligibility.service";

import { createUser } from "@test/seeders/user.seeder";

describe(TrialEligibilityService.name, () => {
  describe("assertEligible", () => {
    it("passes a user nothing refuses", async () => {
      const { service, user } = setup();

      await expect(service.assertEligible(user.id)).resolves.toBeUndefined();
    });

    it("asks a user who has not confirmed their email to confirm it, before any other refusal", async () => {
      const { service, user, userRepository, blockedEmailDomainService } = setup({
        user: createUser({ emailVerified: false, lastFingerprint: faker.string.alphanumeric(32) }),
        hasDuplicateFingerprint: true
      });

      await expect(service.assertEligible(user.id)).rejects.toMatchObject({
        status: 403,
        message: TRIAL_EMAIL_VERIFICATION_REQUIRED_MESSAGE,
        errorCode: EMAIL_VERIFICATION_REQUIRED_ERROR_CODE
      });
      expect(userRepository.findTrialUsersByFingerprint).not.toHaveBeenCalled();
      expect(blockedEmailDomainService.isBlockedEmail).not.toHaveBeenCalled();
    });

    it("refuses a user sharing a fingerprint with another trial account in production", async () => {
      const { service, user, userRepository, featureFlagsService } = setup({ hasDuplicateFingerprint: true });

      await expect(service.assertEligible(user.id)).rejects.toMatchObject({ status: 400, message: TRIAL_UNAVAILABLE_MESSAGE });
      expect(featureFlagsService.isEnabledForSubject).toHaveBeenCalledWith(FeatureFlags.TRIAL_FINGERPRINT_CHECK, user.id);
      expect(userRepository.findTrialUsersByFingerprint).toHaveBeenCalledWith(user.lastFingerprint, user.id);
    });

    it("leaves a shared fingerprint alone outside production, with the check off, or without a fingerprint", async () => {
      const notProduction = setup({ hasDuplicateFingerprint: true, isProduction: false });
      const checkOff = setup({ hasDuplicateFingerprint: true, isFingerprintCheckEnabled: false });
      const noFingerprint = setup({ hasDuplicateFingerprint: true, user: createUser({ emailVerified: true, lastFingerprint: null }) });

      await expect(notProduction.service.assertEligible(notProduction.user.id)).resolves.toBeUndefined();
      await expect(checkOff.service.assertEligible(checkOff.user.id)).resolves.toBeUndefined();
      await expect(noFingerprint.service.assertEligible(noFingerprint.user.id)).resolves.toBeUndefined();
      expect(noFingerprint.userRepository.findTrialUsersByFingerprint).not.toHaveBeenCalled();
    });

    it("refuses a user on a blocked email domain with the message naming the domain", async () => {
      const { service, user, blockedEmailDomainService } = setup({ isBlockedEmailDomain: true });

      await expect(service.assertEligible(user.id)).rejects.toMatchObject({ status: 400, message: TRIAL_BLOCKED_DOMAIN_MESSAGE });
      expect(blockedEmailDomainService.isBlockedEmail).toHaveBeenCalledWith(user.email);
    });

    it("refuses a held user with the generic message", async () => {
      const { service, user, trialSignupHoldService } = setup({ isHeld: true });

      await expect(service.assertEligible(user.id)).rejects.toMatchObject({ status: 400, message: TRIAL_UNAVAILABLE_MESSAGE });
      expect(trialSignupHoldService.isHeld).toHaveBeenCalledWith(user);
    });

    it("asks for no hold once a blocked domain has refused the user", async () => {
      const { service, user, trialSignupHoldService } = setup({ isBlockedEmailDomain: true, isHeld: true });

      await expect(service.assertEligible(user.id)).rejects.toMatchObject({ message: TRIAL_BLOCKED_DOMAIN_MESSAGE });
      expect(trialSignupHoldService.isHeld).not.toHaveBeenCalled();
    });

    it("passes a user that no longer exists, leaving the answer to the activation", async () => {
      const { service, userRepository, trialSignupHoldService } = setup();
      userRepository.findById.mockResolvedValue(undefined);

      await expect(service.assertEligible(faker.string.uuid())).resolves.toBeUndefined();
      expect(trialSignupHoldService.isHeld).not.toHaveBeenCalled();
    });
  });

  function setup(input?: {
    user?: UserOutput;
    isProduction?: boolean;
    isFingerprintCheckEnabled?: boolean;
    hasDuplicateFingerprint?: boolean;
    isBlockedEmailDomain?: boolean;
    isHeld?: boolean;
  }) {
    const user = input?.user ?? createUser({ emailVerified: true, lastFingerprint: faker.string.alphanumeric(32) });
    const featureFlagsService = mock<FeatureFlagsService>({ isEnabledForSubject: vi.fn(() => input?.isFingerprintCheckEnabled ?? true) });
    const stripeService = mock<StripeService>({ isProduction: input?.isProduction ?? true });
    const userRepository = mock<UserRepository>({
      findById: vi.fn().mockResolvedValue(user),
      findTrialUsersByFingerprint: vi.fn().mockResolvedValue(input?.hasDuplicateFingerprint ? [{ id: faker.string.uuid() }] : [])
    });
    const blockedEmailDomainService = mock<BlockedEmailDomainService>({ isBlockedEmail: vi.fn().mockResolvedValue(input?.isBlockedEmailDomain ?? false) });
    const trialSignupHoldService = mock<TrialSignupHoldService>({ isHeld: vi.fn().mockResolvedValue(input?.isHeld ?? false) });
    const service = new TrialEligibilityService(featureFlagsService, stripeService, userRepository, blockedEmailDomainService, trialSignupHoldService);

    return { service, user, featureFlagsService, stripeService, userRepository, blockedEmailDomainService, trialSignupHoldService };
  }
});
