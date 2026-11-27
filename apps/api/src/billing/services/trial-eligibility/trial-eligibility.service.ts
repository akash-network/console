import assert from "http-assert";
import { singleton } from "tsyringe";

import { StripeService } from "@src/billing/services/stripe/stripe.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { type UserOutput, UserRepository } from "@src/user/repositories";
import { BlockedEmailDomainService } from "@src/workload-abuse/services/blocked-email-domain/blocked-email-domain.service";
import { TrialSignupHoldService } from "@src/workload-abuse/services/trial-signup-hold/trial-signup-hold.service";

/** Names the domain, unlike the registration refusal: only a verified account holder sees it, and support needs to be able to act on it. */
export const TRIAL_BLOCKED_DOMAIN_MESSAGE = "Trial is not available for this email domain. Please contact support for assistance.";

export const TRIAL_UNAVAILABLE_MESSAGE = "Unable to start trial. Please contact support for assistance.";

export const TRIAL_EMAIL_VERIFICATION_REQUIRED_MESSAGE = "Confirm your email address to start your trial.";

export const EMAIL_VERIFICATION_REQUIRED_ERROR_CODE = "email_verification_required";

/** The refusals that keep a wallet from ever being activated, shared by the activation itself and by the spends that would otherwise wait on it. */
@singleton()
export class TrialEligibilityService {
  constructor(
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly stripeService: StripeService,
    private readonly userRepository: UserRepository,
    private readonly blockedEmailDomainService: BlockedEmailDomainService,
    private readonly trialSignupHoldService: TrialSignupHoldService
  ) {}

  async assertNoDuplicateFingerprint(user: UserOutput): Promise<void> {
    assert(!(await this.#hasDuplicateFingerprint(user)), 400, TRIAL_UNAVAILABLE_MESSAGE);
  }

  async #hasDuplicateFingerprint(user: UserOutput): Promise<boolean> {
    if (!this.stripeService.isProduction) return false;
    if (!this.featureFlagsService.isEnabledForSubject(FeatureFlags.TRIAL_FINGERPRINT_CHECK, user.id)) return false;
    if (!user.lastFingerprint) return false;

    const usersWithSameFingerprint = await this.userRepository.findTrialUsersByFingerprint(user.lastFingerprint, user.id);

    return usersWithSameFingerprint.length > 0;
  }

  async assertEmailDomainNotBlocked(user: UserOutput): Promise<void> {
    const blocked = await this.blockedEmailDomainService.isBlockedEmail(user.email);
    assert(!blocked, 400, TRIAL_BLOCKED_DOMAIN_MESSAGE);
  }

  async assertNotHeld(user: UserOutput): Promise<void> {
    const held = await this.trialSignupHoldService.isHeld(user);
    assert(!held, 400, TRIAL_UNAVAILABLE_MESSAGE);
  }

  /** Re-evaluated on every call rather than remembered, because a hold lifts by itself once the linked accounts leave its window. */
  async assertEligible(userId: UserOutput["id"]): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) return;

    this.#assertEmailVerified(user);
    await this.assertNoDuplicateFingerprint(user);
    await this.assertEmailDomainNotBlocked(user);
    await this.assertNotHeld(user);
  }

  /** An unconfirmed email is asked for rather than counted as a refusal, since confirming it is all that stands between the account and its trial. */
  async isRefused(userId: UserOutput["id"]): Promise<boolean> {
    const user = await this.userRepository.findById(userId);
    if (!user) return false;

    this.#assertEmailVerified(user);

    return (
      (await this.#hasDuplicateFingerprint(user)) ||
      (await this.blockedEmailDomainService.isBlockedEmail(user.email)) ||
      (await this.trialSignupHoldService.isHeld(user))
    );
  }

  #assertEmailVerified(user: UserOutput): void {
    assert(user.emailVerified, 403, TRIAL_EMAIL_VERIFICATION_REQUIRED_MESSAGE, { errorCode: EMAIL_VERIFICATION_REQUIRED_ERROR_CODE });
  }
}
