import { singleton } from "tsyringe";

import { UserInput, UserWalletRepository } from "@src/billing/repositories";
import { WalletService } from "@src/billing/services";
import { WithTransaction } from "@src/core/services";

@singleton()
export class WalletInitializerService {
  constructor(
    private readonly walletManager: WalletService,
    private readonly userWalletRepository: UserWalletRepository
  ) {}

  @WithTransaction()
  async initialize(userId: UserInput["userId"]) {
    const userWallet = await this.userWalletRepository.create({ userId });
    const wallet = await this.walletManager.createAndAuthorizeTrialSpending({ addressIndex: userWallet.id });
    await this.userWalletRepository.updateById(userWallet.id, { address: wallet.address });
  }
}
