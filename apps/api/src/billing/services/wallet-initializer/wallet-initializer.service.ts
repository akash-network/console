import assert from "http-assert";
import { singleton } from "tsyringe";

import { TrialStarted } from "@src/billing/events/trial-started";
import { isWalletInitialized, type UserWalletPublicOutput, UserWalletRepository, type WalletInitialized } from "@src/billing/repositories";
import { TrialActivationInstrumentationService } from "@src/billing/services/activate-trial/trial-activation-instrumentation.service";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { StripeService } from "@src/billing/services/stripe/stripe.service";
import { TrialValidationService } from "@src/billing/services/trial-validation/trial-validation.service";
import { DomainEventsService } from "@src/core/services/domain-events/domain-events.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { UserOutput, UserRepository } from "@src/user/repositories";
import { ManagedUserWalletService } from "../managed-user-wallet/managed-user-wallet.service";

@singleton()
export class WalletInitializerService {
  constructor(
    private readonly walletManager: ManagedUserWalletService,
    private readonly managedSignerService: ManagedSignerService,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly domainEvents: DomainEventsService,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly stripeService: StripeService,
    private readonly userRepository: UserRepository,
    private readonly trialActivationInstrumentation: TrialActivationInstrumentationService,
    private readonly trialValidationService: TrialValidationService
  ) {}

  async #assertNoDuplicateFingerprint(user: UserOutput): Promise<void> {
    if (!this.stripeService.isProduction) return;
    if (!this.featureFlagsService.isEnabled(FeatureFlags.TRIAL_FINGERPRINT_CHECK)) return;
    if (!user.lastFingerprint) return;

    const usersWithSameFingerprint = await this.userRepository.findTrialUsersByFingerprint(user.lastFingerprint, user.id);
    assert(usersWithSameFingerprint.length === 0, 400, "Unable to start trial. Please contact support for assistance.");
  }

  /**
   * Provisions the trial: grants on-chain deployment/fee allowances and marks the wallet activated. Runs from a
   * background job (no request context), so it resolves the user itself and enforces the trial preconditions —
   * email verified and no duplicate fingerprint — that used to live in the removed start-trial endpoint.
   *
   * `activatedAt` is set only after the grants land, so it doubles as the spend gate's "ready" signal: a deploy
   * arriving mid-provisioning sees no `activatedAt` and gets a retriable 409 rather than a bare 402 off empty
   * allowances. Concurrency is handled upstream — the ActivateTrial queue is `policy: singleton`, so at most one
   * job per user is ever active — and the grants are idempotent (revoke-then-regrant / authz overwrite), so a
   * crashed job just re-runs on retry and re-converges to the same limits. No claim or rollback needed.
   */
  async initializeAndGrantTrialLimits(userId: string): Promise<UserWalletPublicOutput> {
    const user = await this.userRepository.findById(userId);
    assert(user, 404, "User Not Found");
    assert(user.emailVerified, 400, "Email not verified");
    await this.#assertNoDuplicateFingerprint(user);

    const userWallet = await this.ensureWallet(userId);
    if (userWallet.activatedAt) return this.#toPublic(userWallet);

    const chainWallet = await this.walletManager.createAndAuthorizeTrialSpending(this.managedSignerService, { addressIndex: userWallet.id });
    const activatedWallet = await this.userWalletRepository.updateById(
      userWallet.id,
      {
        deploymentAllowance: chainWallet.limits.deployment,
        feeAllowance: chainWallet.limits.fees,
        activatedAt: new Date()
      },
      { returning: true }
    );

    await this.domainEvents.publish(new TrialStarted({ userId }));
    this.trialActivationInstrumentation.recordActivated(userId, Date.now() - new Date(activatedWallet.createdAt).getTime());

    return this.#toPublic({ ...activatedWallet, address: userWallet.address });
  }

  #toPublic(wallet: WalletInitialized): UserWalletPublicOutput {
    return this.userWalletRepository.toPublic(wallet, { trialEndsAt: this.trialValidationService.getTrialEndsAt(wallet) });
  }

  /**
   * Idempotently guarantees the user has a wallet row with a derived address.
   * Address derivation is pure (no chain transaction), so this is safe to run on every registration.
   * Concurrent calls may both derive the address, but derivation is deterministic per wallet id,
   * so the two updates write the same value and the operation stays idempotent.
   */
  async ensureWallet(userId: string): Promise<WalletInitialized> {
    const { wallet } = await this.userWalletRepository.getOrCreate({ userId });
    if (isWalletInitialized(wallet)) return wallet;

    const { address } = await this.walletManager.createWallet({ addressIndex: wallet.id });
    await this.userWalletRepository.updateById(wallet.id, { address });
    return { ...wallet, address };
  }
}
