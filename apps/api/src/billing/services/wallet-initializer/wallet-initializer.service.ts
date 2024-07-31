import pick from "lodash/pick";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { UserWalletInput, UserWalletRepository } from "@src/billing/repositories";
import { ManagedUserWalletService } from "@src/billing/services";
import { WithTransaction } from "@src/core/services";

@singleton()
export class WalletInitializerService {
  constructor(
    private readonly walletManager: ManagedUserWalletService,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly authService: AuthService
  ) {}

  @WithTransaction()
  async initialize(userId: UserWalletInput["userId"]) {
    const { id } = await this.userWalletRepository.accessibleBy(this.authService.ability, "create").create({ userId });
    const wallet = await this.walletManager.createAndAuthorizeTrialSpending({ addressIndex: id });
    const userWallet = await this.userWalletRepository.updateById(
      id,
      {
        address: wallet.address,
        deploymentAllowance: String(wallet.limits.deployment),
        feeAllowance: String(wallet.limits.fees)
      },
      { returning: true }
    );

    return pick(userWallet, ["id", "userId", "address", "creditAmount"]);
  }
}
