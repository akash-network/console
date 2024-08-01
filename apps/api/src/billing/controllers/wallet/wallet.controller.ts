import type { EncodeObject } from "@cosmjs/proto-signing";
import pick from "lodash/pick";
import { singleton } from "tsyringe";

import type { WalletListOutputResponse, WalletOutputResponse } from "@src/billing/http-schemas/wallet.schema";
import { UserWalletRepository } from "@src/billing/repositories";
import type { CreateWalletRequestInput, SignTxRequestInput, SignTxResponseOutput } from "@src/billing/routes";
import { GetWalletQuery } from "@src/billing/routes/get-wallet-list/get-wallet-list.router";
import { ManagedUserWalletService, WalletInitializerService } from "@src/billing/services";
import { RefillService } from "@src/billing/services/refill/refill.service";
import { TxSignerService } from "@src/billing/services/tx-signer/tx-signer.service";

// TODO: authorize endpoints below
@singleton()
export class WalletController {
  constructor(
    private readonly walletManager: ManagedUserWalletService,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly walletInitializer: WalletInitializerService,
    private readonly signerService: TxSignerService,
    private readonly refillService: RefillService
  ) {}

  async create({ data: { userId } }: CreateWalletRequestInput): Promise<WalletOutputResponse> {
    return {
      data: await this.walletInitializer.initialize(userId)
    };
  }

  async getWallets(query: GetWalletQuery): Promise<WalletListOutputResponse> {
    const wallets = await this.userWalletRepository.find(query);
    return {
      data: wallets.map(wallet => pick(wallet, ["id", "userId", "address", "creditAmount"]))
    };
  }

  async signTx({ data: { userId, messages } }: SignTxRequestInput): Promise<SignTxResponseOutput> {
    return {
      data: await this.signerService.signAndBroadcast(userId, messages as EncodeObject[])
    };
  }

  async refillWallets() {
    await this.refillService.refillAll();
  }
}
