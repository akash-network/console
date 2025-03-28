import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { UserWalletInput, UserWalletPublicOutput, UserWalletRepository } from "@src/billing/repositories";
import { ManagedUserWalletService } from "@src/billing/services";

@singleton()
export class WalletInitializerService {
  constructor(
    private readonly walletManager: ManagedUserWalletService,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly authService: AuthService
  ) {}

  async initializeAndGrantTrialLimits(userId: UserWalletInput["userId"]): Promise<UserWalletPublicOutput> {
    let userWallet = await this.userWalletRepository.findOneByUserId(userId);
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
