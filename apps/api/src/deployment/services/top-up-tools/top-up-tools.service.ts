import { singleton } from "tsyringe";

import { InjectSigningClient } from "@src/billing/providers/signing-client.provider";
import { InjectWallet } from "@src/billing/providers/wallet.provider";
import { MasterSigningClientService, MasterWalletService } from "@src/billing/services";
import { TopUpMasterWalletType } from "@src/billing/types/wallet.type";

@singleton()
export class TopUpToolsService {
  readonly TYPES: TopUpMasterWalletType[] = ["UAKT_TOP_UP", "USDC_TOP_UP"];

  readonly pairs: { wallet: MasterWalletService; client: MasterSigningClientService }[];

  private readonly wallets: Record<TopUpMasterWalletType, MasterWalletService>;

  private readonly clients: Record<TopUpMasterWalletType, MasterSigningClientService>;

  constructor(
    @InjectWallet("UAKT_TOP_UP") private readonly uaktMasterWalletService: MasterWalletService,
    @InjectWallet("USDC_TOP_UP") private readonly usdtMasterWalletService: MasterWalletService,
    @InjectSigningClient("UAKT_TOP_UP") private readonly uaktMasterSigningClientService: MasterSigningClientService,
    @InjectSigningClient("USDC_TOP_UP") private readonly usdtMasterSigningClientService: MasterSigningClientService
  ) {
    this.wallets = {
      UAKT_TOP_UP: this.uaktMasterWalletService,
      USDC_TOP_UP: this.usdtMasterWalletService
    };

    this.clients = {
      UAKT_TOP_UP: this.uaktMasterSigningClientService,
      USDC_TOP_UP: this.usdtMasterSigningClientService
    };

    this.pairs = this.TYPES.map(walletType => ({
      wallet: this.walletFor(walletType),
      client: this.clientFor(walletType)
    }));
  }

  walletFor(walletType: TopUpMasterWalletType): MasterWalletService {
    return this.wallets[walletType];
  }

  clientFor(walletType: TopUpMasterWalletType): MasterSigningClientService {
    return this.clients[walletType];
  }
}
