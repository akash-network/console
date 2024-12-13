import { singleton } from "tsyringe";

import { InjectSigningClient } from "@src/billing/providers/signing-client.provider";
import { InjectWallet } from "@src/billing/providers/wallet.provider";
import { BatchSigningClientService, Wallet } from "@src/billing/services";
import { TopUpMasterWalletType } from "@src/billing/types/wallet.type";

@singleton()
export class TopUpToolsService {
  readonly TYPES: TopUpMasterWalletType[] = ["UAKT_TOP_UP", "USDC_TOP_UP"];

  readonly pairs: { wallet: Wallet; client: BatchSigningClientService }[];

  private readonly wallets: Record<TopUpMasterWalletType, Wallet>;

  private readonly clients: Record<TopUpMasterWalletType, BatchSigningClientService>;

  constructor(
    @InjectWallet("UAKT_TOP_UP") private readonly uaktWallet: Wallet,
    @InjectWallet("USDC_TOP_UP") private readonly usdtWallet: Wallet,
    @InjectSigningClient("UAKT_TOP_UP") private readonly uaktBatchSigningClientService: BatchSigningClientService,
    @InjectSigningClient("USDC_TOP_UP") private readonly usdtBatchSigningClientService: BatchSigningClientService
  ) {
    this.wallets = {
      UAKT_TOP_UP: this.uaktWallet,
      USDC_TOP_UP: this.usdtWallet
    };

    this.clients = {
      UAKT_TOP_UP: this.uaktBatchSigningClientService,
      USDC_TOP_UP: this.usdtBatchSigningClientService
    };

    this.pairs = this.TYPES.map(walletType => ({
      wallet: this.walletFor(walletType),
      client: this.clientFor(walletType)
    }));
  }

  walletFor(walletType: TopUpMasterWalletType): Wallet {
    return this.wallets[walletType];
  }

  clientFor(walletType: TopUpMasterWalletType): BatchSigningClientService {
    return this.clients[walletType];
  }
}
