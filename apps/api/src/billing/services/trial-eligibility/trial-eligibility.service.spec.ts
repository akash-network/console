import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { StripeService } from "@src/billing/services/stripe/stripe.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { UserOutput, UserRepository } from "@src/user/repositories";
import type { BlockedEmailDomainService } from "@src/workload-abuse/services/blocked-email-domain/blocked-email-domain.service";
import type { TrialCardService } from "@src/workload-abuse/services/trial-card/trial-card.service";
import type { TrialSignupHoldService } from "@src/workload-abuse/services/trial-signup-hold/trial-signup-hold.service";
import {
  EMAIL_VERIFICATION_REQUIRED_ERROR_CODE,
  TRIAL_BLOCKED_DOMAIN_MESSAGE,
  TRIAL_CARD_REQUIRED_ERROR_CODE,
  TRIAL_CARD_REQUIRED_MESSAGE,
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

  describe("assertNotHeld", () => {
    it("refuses a held user with the generic message and no code while the card step is off", async () => {
      const { service, user } = setup({ isHeld: true, isCardStepOffered: false });

      const refusal = await service.assertNotHeld(user).catch(error => error);

      expect(refusal).toMatchObject({ status: 400, message: TRIAL_UNAVAILABLE_MESSAGE });
      expect(refusal.errorCode).toBeUndefined();
    });

    it("asks a held user for a card while the card step is on", async () => {
      const { service, user } = setup({ isHeld: true, isCardStepOffered: true });

      await expect(service.assertNotHeld(user)).rejects.toMatchObject({
        status: 400,
        message: TRIAL_CARD_REQUIRED_MESSAGE,
        errorCode: TRIAL_CARD_REQUIRED_ERROR_CODE
      });
    });

    it("passes a user with a verified card without reading the hold", async () => {
      const { service, user, trialCardService, trialSignupHoldService } = setup({ isHeld: true, isCardStepOffered: true, hasVerifiedCard: true });

      await expect(service.assertNotHeld(user)).resolves.toBeUndefined();

      expect(trialCardService.hasVerifiedCard).toHaveBeenCalledWith(user.id);
      expect(trialSignupHoldService.isHeld).not.toHaveBeenCalled();
    });

    it("passes a user nothing holds, whether the card step is on or off", async () => {
      const on = setup({ isHeld: false, isCardStepOffered: true });
      const off = setup({ isHeld: false, isCardStepOffered: false });

      await expect(on.service.assertNotHeld(on.user)).resolves.toBeUndefined();
      await expect(off.service.assertNotHeld(off.user)).resolves.toBeUndefined();
    });
  });

  describe("findCardStep", () => {
    it("asks a held user for a card", async () => {
      const { service, user, trialSignupHoldService } = setup({ isHeld: true, isCardStepOffered: true });

      await expect(service.findCardStep(user.id)).resolves.toBe("required");
      expect(trialSignupHoldService.isHeld).toHaveBeenCalledWith(user);
    });

    it("asks nothing of a user nothing holds", async () => {
      const { service, user } = setup({ isHeld: false, isCardStepOffered: true });

      await expect(service.findCardStep(user.id)).resolves.toBe("not_required");
    });

    it("reports a verified card without reading the hold", async () => {
      const { service, user, trialSignupHoldService } = setup({ isHeld: true, isCardStepOffered: true, hasVerifiedCard: true });

      await expect(service.findCardStep(user.id)).resolves.toBe("verified");
      expect(trialSignupHoldService.isHeld).not.toHaveBeenCalled();
    });

    it("asks nothing and reads nothing while the card step is off", async () => {
      const { service, user, trialCardService, trialSignupHoldService } = setup({ isHeld: true, isCardStepOffered: false, hasVerifiedCard: true });

      await expect(service.findCardStep(user.id)).resolves.toBe("not_required");
      expect(trialCardService.hasVerifiedCard).not.toHaveBeenCalled();
      expect(trialSignupHoldService.isHeld).not.toHaveBeenCalled();
    });

    it("asks nothing of a user who has not confirmed their email, or who no longer exists", async () => {
      const unverified = setup({
        user: createUser({ emailVerified: false, lastFingerprint: faker.string.alphanumeric(32) }),
        isHeld: true,
        isCardStepOffered: true
      });
      const missing = setup({ isHeld: true, isCardStepOffered: true });
      missing.userRepository.findById.mockResolvedValue(undefined);

      await expect(unverified.service.findCardStep(unverified.user.id)).resolves.toBe("not_required");
      await expect(missing.service.findCardStep(faker.string.uuid())).resolves.toBe("not_required");
      expect(unverified.trialSignupHoldService.isHeld).not.toHaveBeenCalled();
      expect(missing.trialSignupHoldService.isHeld).not.toHaveBeenCalled();
    });

    it("asks no card of a user a card cannot help: a shared fingerprint or a blocked email domain", async () => {
      const duplicate = setup({ isHeld: true, isCardStepOffered: true, hasDuplicateFingerprint: true });
      const blocked = setup({ isHeld: true, isCardStepOffered: true, isBlockedEmailDomain: true });

      await expect(duplicate.service.findCardStep(duplicate.user.id)).resolves.toBe("not_required");
      await expect(blocked.service.findCardStep(blocked.user.id)).resolves.toBe("not_required");
      expect(duplicate.trialSignupHoldService.isHeld).not.toHaveBeenCalled();
      expect(blocked.trialSignupHoldService.isHeld).not.toHaveBeenCalled();
    });
  });

  describe("isRefused", () => {
    it("answers no for a held user whose card is verified, without reading the hold", async () => {
      const { service, user, trialSignupHoldService } = setup({ isHeld: true, isCardStepOffered: true, hasVerifiedCard: true });

      await expect(service.isRefused(user.id)).resolves.toBe(false);
      expect(trialSignupHoldService.isHeld).not.toHaveBeenCalled();
    });

    it("answers yes for a held user who is asked for a card and has not added one", async () => {
      const { service, user } = setup({ isHeld: true, isCardStepOffered: true });

      await expect(service.isRefused(user.id)).resolves.toBe(true);
    });

    it("answers no for a user nothing refuses", async () => {
      const { service, user } = setup();

      await expect(service.isRefused(user.id)).resolves.toBe(false);
    });

    it.each([{ hasDuplicateFingerprint: true }, { isBlockedEmailDomain: true }, { isHeld: true }])("answers yes for a user refused over %o", async refusal => {
      const { service, user } = setup(refusal);

      await expect(service.isRefused(user.id)).resolves.toBe(true);
    });

    it("leaves a shared fingerprint alone outside production, with the check off, or without a fingerprint", async () => {
      const notProduction = setup({ hasDuplicateFingerprint: true, isProduction: false });
      const checkOff = setup({ hasDuplicateFingerprint: true, isFingerprintCheckEnabled: false });
      const noFingerprint = setup({ hasDuplicateFingerprint: true, user: createUser({ emailVerified: true, lastFingerprint: null }) });

      await expect(notProduction.service.isRefused(notProduction.user.id)).resolves.toBe(false);
      await expect(checkOff.service.isRefused(checkOff.user.id)).resolves.toBe(false);
      await expect(noFingerprint.service.isRefused(noFingerprint.user.id)).resolves.toBe(false);
    });

    it("asks a user who has not confirmed their email to confirm it instead of answering", async () => {
      const { service, user, trialSignupHoldService } = setup({ user: createUser({ emailVerified: false }), isHeld: true });

      await expect(service.isRefused(user.id)).rejects.toMatchObject({
        status: 403,
        message: TRIAL_EMAIL_VERIFICATION_REQUIRED_MESSAGE,
        errorCode: EMAIL_VERIFICATION_REQUIRED_ERROR_CODE
      });
      expect(trialSignupHoldService.isHeld).not.toHaveBeenCalled();
    });

    it("asks for the hold with the user's own record, and only once nothing else refuses", async () => {
      const held = setup({ isHeld: true });
      const blocked = setup({ isBlockedEmailDomain: true, isHeld: true });

      await held.service.isRefused(held.user.id);
      await blocked.service.isRefused(blocked.user.id);

      expect(held.blockedEmailDomainService.isBlockedEmail).toHaveBeenCalledWith(held.user.email);
      expect(held.trialSignupHoldService.isHeld).toHaveBeenCalledWith(held.user);
      expect(blocked.trialSignupHoldService.isHeld).not.toHaveBeenCalled();
    });

    it("answers no for a user that no longer exists", async () => {
      const { service, userRepository, trialSignupHoldService } = setup();
      userRepository.findById.mockResolvedValue(undefined);

      await expect(service.isRefused(faker.string.uuid())).resolves.toBe(false);
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
    isCardStepOffered?: boolean;
    hasVerifiedCard?: boolean;
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
    const trialCardService = mock<TrialCardService>({
      isOffered: vi.fn(() => input?.isCardStepOffered ?? false),
      hasVerifiedCard: vi.fn().mockResolvedValue(input?.hasVerifiedCard ?? false)
    });
    const service = new TrialEligibilityService(
      featureFlagsService,
      stripeService,
      userRepository,
      blockedEmailDomainService,
      trialSignupHoldService,
      trialCardService
    );

    return { service, user, featureFlagsService, stripeService, userRepository, blockedEmailDomainService, trialSignupHoldService, trialCardService };
  }
});
