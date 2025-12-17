import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { TrialStarted } from "@src/billing/events/trial-started";
import { UserWalletPublicOutput, UserWalletRepository } from "@src/billing/repositories";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { DomainEventsService } from "@src/core/services/domain-events/domain-events.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { ManagedUserWalletService } from "../managed-user-wallet/managed-user-wallet.service";

@singleton()
export class WalletInitializerService {
  constructor(
    private readonly walletManager: ManagedUserWalletService,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly managedSignerService: ManagedSignerService,
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
      const wallet = await this.walletManager.createAndAuthorizeTrialSpending(this.managedSignerService, { addressIndex: userWallet.id, useOldWallet: false });
      userWallet = await this.userWalletRepository.updateById(
        userWallet.id,
        {
          address: wallet.address
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

  async initialize(userId: string) {
    const { id } = await this.userWalletRepository.create({ userId });
    const wallet = await this.walletManager.createWallet({ addressIndex: id, useOldWallet: false });
    return await this.userWalletRepository.updateById(
      id,
      {
        address: wallet.address
      },
      { returning: true }
    );
  }
}
