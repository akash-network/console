import { PromisePool } from "@supercharge/promise-pool";
import { singleton } from "tsyringe";

import { UserWalletRepository } from "@src/billing/repositories";
import { CreateWalletInput, CreateWalletOutput } from "@src/billing/routes";
import { WalletInitializerService, WalletService } from "@src/billing/services";
import { WithTransaction } from "@src/core/services";

@singleton()
export class WalletController {
  constructor(
    private readonly walletManager: WalletService,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly walletInitializer: WalletInitializerService
  ) {}

  @WithTransaction()
  async create({ userId }: CreateWalletInput): Promise<CreateWalletOutput> {
    await this.walletInitializer.initialize(userId);
  }

  async refillAll() {
    const wallets = await this.userWalletRepository.find();
    const { results, errors } = await PromisePool.withConcurrency(2)
      .for(wallets)
      .process(async wallet => {
        const refilled = await this.walletManager.refill(wallet);
        console.log("DEBUG refilled", refilled);
        return refilled;
      });

    if (errors) {
      console.log("DEBUG errors", errors);
    }

    console.log("DEBUG results", results);
  }
}
