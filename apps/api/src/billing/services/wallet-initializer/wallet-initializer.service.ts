import assert from "http-assert";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { TrialStarted } from "@src/billing/events/trial-started";
import { UserWalletOutput, UserWalletPublicOutput, UserWalletRepository } from "@src/billing/repositories";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { StripeService } from "@src/billing/services/stripe/stripe.service";
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
    private readonly authService: AuthService,
    private readonly domainEvents: DomainEventsService,
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly stripeService: StripeService,
    private readonly userRepository: UserRepository
  ) {}

  async startTrial(userId: string): Promise<UserWalletPublicOutput> {
    const { currentUser } = this.authService;

    assert(currentUser.emailVerified, 400, "Email not verified");
    await this.#assertNoDuplicateFingerprint(currentUser);

    return this.initializeAndGrantTrialLimits(userId);
  }

  async #assertNoDuplicateFingerprint(user: UserOutput): Promise<void> {
    if (!this.stripeService.isProduction) return;
    if (!this.featureFlagsService.isEnabled(FeatureFlags.TRIAL_FINGERPRINT_CHECK)) return;
    if (!user.lastFingerprint) return;

    const usersWithSameFingerprint = await this.userRepository.findTrialUsersByFingerprint(user.lastFingerprint, user.id);
    assert(usersWithSameFingerprint.length === 0, 400, "Unable to start trial. Please contact support for assistance.");
  }

  async initializeAndGrantTrialLimits(userId: string): Promise<UserWalletPublicOutput> {
    const userWallet = await this.#ensureWalletVia(this.userWalletRepository.accessibleBy(this.authService.ability, "create"), userId);

    if (userWallet.activatedAt) return this.userWalletRepository.toPublic(userWallet);

    const claimedWallet = await this.userWalletRepository.claimActivation(userWallet.id);
    assert(claimedWallet, 409, "Trial provisioning is already in progress");

    let activatedWallet: UserWalletOutput;
    try {
      const chainWallet = await this.walletManager.createAndAuthorizeTrialSpending(this.managedSignerService, { addressIndex: claimedWallet.id });
      activatedWallet = await this.userWalletRepository.updateById(
        claimedWallet.id,
        {
          deploymentAllowance: chainWallet.limits.deployment,
          feeAllowance: chainWallet.limits.fees
        },
        { returning: true }
      );
    } catch (error) {
      await this.userWalletRepository.updateById(claimedWallet.id, { activatedAt: null });
      throw error;
    }

    await this.domainEvents.publish(new TrialStarted({ userId }));

    return this.userWalletRepository.toPublic(activatedWallet);
  }

  /**
   * Idempotently guarantees the user has a wallet row with a derived address.
   * Address derivation is pure (no chain transaction), so this is safe to run on every registration.
   */
  async ensureWallet(userId: string): Promise<UserWalletOutput> {
    return this.#ensureWalletVia(this.userWalletRepository, userId);
  }

  /**
   * Concurrent calls may both derive the address, but derivation is deterministic per wallet id,
   * so the two updates write the same value and the operation stays idempotent.
   */
  async #ensureWalletVia(repository: UserWalletRepository, userId: string): Promise<UserWalletOutput> {
    const { wallet } = await repository.getOrCreate({ userId });

    if (wallet.address) return wallet;

    const { address } = await this.walletManager.createWallet({ addressIndex: wallet.id });
    return await this.userWalletRepository.updateById(wallet.id, { address }, { returning: true });
  }
}
