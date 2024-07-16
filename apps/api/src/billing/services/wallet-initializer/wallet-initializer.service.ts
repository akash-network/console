import pick from "lodash/pick";
import { singleton } from "tsyringe";

import { UserInput, UserWalletRepository } from "@src/billing/repositories";
import { ManagedUserWalletService } from "@src/billing/services";
import { WithTransaction } from "@src/core/services";

@singleton()
export class WalletInitializerService {
  constructor(
    private readonly walletManager: ManagedUserWalletService,
    private readonly userWalletRepository: UserWalletRepository
  ) {}

  @WithTransaction()
  async initialize(userId: UserInput["userId"]) {
    const { id } = await this.userWalletRepository.create({ userId });
    const wallet = await this.walletManager.createAndAuthorizeTrialSpending({ addressIndex: id });
    const userWallet = await this.userWalletRepository.updateById(id, { address: wallet.address }, { returning: true });

    return pick(userWallet, ["id", "userId", "address", "creditAmount"]);
  }
}
