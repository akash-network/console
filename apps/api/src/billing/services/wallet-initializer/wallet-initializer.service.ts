import assert from "http-assert";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { BlaStarted, TrialStarted } from "@src/billing/events/trial-started";
import { UserWalletPublicOutput, UserWalletRepository } from "@src/billing/repositories";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { StripeService } from "@src/billing/services/stripe/stripe.service";
import { DomainEventsService } from "@src/core/services/domain-events/domain-events.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { UserOutput, UserRepository } from "@src/user/repositories";
import { ManagedUserWalletService } from "../managed-user-wallet/managed-user-wallet.service";
import { TxService } from "@src/core";

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
    private readonly userRepository: UserRepository,
    private readonly txService: TxService
  ) {}

  async startTrial(userId: string): Promise<UserWalletPublicOutput> {
    const { currentUser } = this.authService;

    // assert(currentUser.emailVerified, 400, "Email not verified");
    // await this.#assertNoDuplicateFingerprint(currentUser);

    return this.createWalletWithTrialLimits(userId);
  }

  async #assertNoDuplicateFingerprint(user: UserOutput): Promise<void> {
    if (!this.stripeService.isProduction) return;
    if (!this.featureFlagsService.isEnabled(FeatureFlags.TRIAL_FINGERPRINT_CHECK)) return;
    if (!user.lastFingerprint) return;

    const usersWithSameFingerprint = await this.userRepository.findTrialUsersByFingerprint(user.lastFingerprint, user.id);
    assert(usersWithSameFingerprint.length === 0, 400, "Unable to start trial. Please contact support for assistance.");
  }

  async createWalletWithTrialLimits(userId: string): Promise<UserWalletPublicOutput> {
    return await this.txService.transaction(async () => {
      const { wallet, isNew } = await this.userWalletRepository.accessibleBy(this.authService.ability, "create").getOrCreate({ userId });
      await this.domainEvents.publish(new BlaStarted({ userId }));
      return this.userWalletRepository.toPublic(wallet);
    });
  }

  async initializeAndGrantTrialLimits(userId: string): Promise<UserWalletPublicOutput> {
    const { wallet, isNew } = await this.userWalletRepository.accessibleBy(this.authService.ability, "create").getOrCreate({ userId });
    let userWallet = wallet;
    if (!isNew) return this.userWalletRepository.toPublic(userWallet);

    try {
      const wallet = await this.walletManager.createAndAuthorizeTrialSpending(this.managedSignerService, { addressIndex: userWallet.id });
      userWallet = await this.userWalletRepository.updateById(
        userWallet.id,
        {
          address: wallet.address,
          deploymentAllowance: wallet.limits.deployment,
          feeAllowance: wallet.limits.fees
        },
        { returning: true }
      );
    } catch (error) {
      await this.userWalletRepository.deleteById(userWallet.id);
      throw error;
    }

    const walletOutput = this.userWalletRepository.toPublic(userWallet);
    await this.domainEvents.publish(new TrialStarted({ userId }));

    return walletOutput;
  }

  async initialize(userId: string) {
    const { id } = await this.userWalletRepository.create({ userId });
    const wallet = await this.walletManager.createWallet({ addressIndex: id });
    return await this.userWalletRepository.updateById(
      id,
      {
        address: wallet.address
      },
      { returning: true }
    );
  }
}
