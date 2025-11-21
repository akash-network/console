import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { TrialStarted } from "@src/billing/events/trial-started";
import { UserWalletInput, type UserWalletOutput, UserWalletPublicOutput, UserWalletRepository } from "@src/billing/repositories";
import { DomainEventsService } from "@src/core/services/domain-events/domain-events.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { ManagedUserWalletService } from "../managed-user-wallet/managed-user-wallet.service";

@singleton()
export class WalletInitializerService {
  constructor(
    private readonly walletManager: ManagedUserWalletService,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly authService: AuthService,
    private readonly domainEvents: DomainEventsService,
    private readonly featureFlagsService: FeatureFlagsService
  ) {}

  async initializeAndGrantTrialLimits(userId: string): Promise<UserWalletPublicOutput> {
    const { wallet, isNew } = await this.userWalletRepository.accessibleBy(this.authService.ability, "create").getOrCreate({ userId });
    let userWallet = wallet;
    if (!isNew) return this.userWalletRepository.toPublic(userWallet);

    let isTrialSpendingAuthorized = false;
    try {
      const wallet = await this.walletManager.createAndAuthorizeTrialSpending({ addressIndex: userWallet.id });
      userWallet = await this.userWalletRepository.updateById(
        userWallet.id,
        {
          deploymentAllowance: wallet.limits.deployment,
          feeAllowance: wallet.limits.fees,
          ...wallet.addresses
        },
        { returning: true }
      );
      isTrialSpendingAuthorized = true;
    } catch (error) {
      await this.userWalletRepository.deleteById(userWallet.id);
      throw error;
    }

    const walletOutput = this.userWalletRepository.toPublic(userWallet);

    if (isTrialSpendingAuthorized && !this.featureFlagsService.isEnabled(FeatureFlags.ANONYMOUS_FREE_TRIAL)) {
      await this.domainEvents.publish(new TrialStarted({ userId }));
    }

    return walletOutput;
  }

  async initialize(userId: UserWalletInput["userId"]): Promise<Omit<UserWalletOutput, "address"> & { address: string }> {
    const { id } = await this.userWalletRepository.create({ userId });
    const wallet = await this.walletManager.createWallet({ addressIndex: id });
    return await this.userWalletRepository.updateById(id, wallet, { returning: true });
  }
}
