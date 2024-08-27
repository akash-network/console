import type { EncodeObject } from "@cosmjs/proto-signing";
import { Lifecycle, scoped } from "tsyringe";

import { Protected } from "@src/auth/services/auth.service";
import type { WalletListOutputResponse, WalletOutputResponse } from "@src/billing/http-schemas/wallet.schema";
import type { CreateWalletRequestInput, SignTxRequestInput, SignTxResponseOutput } from "@src/billing/routes";
import { GetWalletQuery } from "@src/billing/routes/get-wallet-list/get-wallet-list.router";
import { WalletInitializerService } from "@src/billing/services";
import { RefillService } from "@src/billing/services/refill/refill.service";
import { TxSignerService } from "@src/billing/services/tx-signer/tx-signer.service";
import { GetWalletOptions, WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";

@scoped(Lifecycle.ResolutionScoped)
export class WalletController {
  constructor(
    private readonly walletInitializer: WalletInitializerService,
    private readonly signerService: TxSignerService,
    private readonly refillService: RefillService,
    private readonly walletReaderService: WalletReaderService
  ) {}

  @Protected([{ action: "create", subject: "UserWallet" }])
  async create({ data: { userId } }: CreateWalletRequestInput): Promise<WalletOutputResponse> {
    return {
      data: await this.walletInitializer.initializeAndGrantTrialLimits(userId)
    };
  }

  @Protected([{ action: "read", subject: "UserWallet" }])
  async getWallets(query: GetWalletQuery): Promise<WalletListOutputResponse> {
    return {
      data: await this.walletReaderService.getWallets(query as GetWalletOptions)
    };
  }

  @Protected([{ action: "sign", subject: "UserWallet" }])
  async signTx({ data: { userId, messages } }: SignTxRequestInput): Promise<SignTxResponseOutput> {
    return {
      data: await this.signerService.signAndBroadcast(userId, messages as EncodeObject[])
    };
  }

  async refillWallets() {
    await this.refillService.refillAllFees();
  }
}
