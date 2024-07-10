import type { EncodeObject } from "@cosmjs/proto-signing";
import type { StdFee } from "@cosmjs/stargate";
import { PromisePool } from "@supercharge/promise-pool";
import { singleton } from "tsyringe";

import { UserWalletRepository } from "@src/billing/repositories";
import type { CreateWalletInput, CreateWalletOutput, SignTxInput, SignTxOutput } from "@src/billing/routes";
import { ManagedUserWalletService, WalletInitializerService } from "@src/billing/services";
import { TxSignerService } from "@src/billing/services/tx-signer/tx-signer.service";
import { WithTransaction } from "@src/core/services";

@singleton()
export class WalletController {
  constructor(
    private readonly walletManager: ManagedUserWalletService,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly walletInitializer: WalletInitializerService,
    private readonly signerService: TxSignerService
  ) {}

  @WithTransaction()
  async create({ userId }: CreateWalletInput): Promise<CreateWalletOutput> {
    return await this.walletInitializer.initialize(userId);
  }

  async signTx({ userId, messages, fee }: SignTxInput): Promise<SignTxOutput> {
    return await this.signerService.sign(userId, messages as EncodeObject[], fee as StdFee);
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
