import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { UserWalletInput, UserWalletPublicOutput, UserWalletRepository } from "@src/billing/repositories";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { startTrialNotification } from "@src/notifications/services/notification-templates/start-trial-notification";
import { ManagedUserWalletService } from "../managed-user-wallet/managed-user-wallet.service";

@singleton()
export class WalletInitializerService {
  constructor(
    private readonly walletManager: ManagedUserWalletService,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly authService: AuthService,
    private readonly notificationService: NotificationService,
    private readonly featureFlagsService: FeatureFlagsService
  ) {}

  async initializeAndGrantTrialLimits(userId: UserWalletInput["userId"]): Promise<UserWalletPublicOutput> {
    let userWallet = await this.userWalletRepository.findOneByUserId(userId!);
    if (userWallet) return this.userWalletRepository.toPublic(userWallet);

    userWallet = await this.userWalletRepository.accessibleBy(this.authService.ability, "create").create({ userId });

    try {
      const wallet = await this.walletManager.createAndAuthorizeTrialSpending({ addressIndex: userWallet.id });
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

    if (!this.featureFlagsService.isEnabled(FeatureFlags.ANONYMOUS_FREE_TRIAL) && this.authService.currentUser?.email) {
      await this.notificationService.createNotification(startTrialNotification(this.authService.currentUser));
    }

    return this.userWalletRepository.toPublic(userWallet);
  }

  async initialize(userId: UserWalletInput["userId"]) {
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
