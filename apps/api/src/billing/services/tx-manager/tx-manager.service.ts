import type { EncodeObject } from "@cosmjs/proto-signing";
import { container, inject, type InjectionToken, instancePerContainerCachingFactory, singleton } from "tsyringe";

import type { SignAndBroadcastOptions } from "@src/billing/lib/batch-signing-client/batch-signing-client.service";
import { Wallet } from "@src/billing/lib/wallet/wallet";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { ExternalSignerHttpSdkService } from "@src/billing/services/external-signer-http-sdk/external-signer-http-sdk.service";
import { LoggerService } from "@src/core";

export type WalletFactory = (walletIndex?: number) => Wallet;
type WalletVersionConfig = {
  masterWallet: Wallet;
  derivedWalletFactory: WalletFactory;
};

type WalletVersion = "v1" | "v2";
type WalletResources = Record<WalletVersion, WalletVersionConfig>;

const WALLET_RESOURCES: InjectionToken<WalletResources> = Symbol("WALLET_RESOURCES");

container.register(WALLET_RESOURCES, {
  useFactory: instancePerContainerCachingFactory(c => {
    const config = c.resolve(BillingConfigService);

    const v1MasterWallet = new Wallet(config.get("FUNDING_WALLET_MNEMONIC_V1") ?? config.get("OLD_MASTER_WALLET_MNEMONIC"));
    const v2MasterWallet = new Wallet(config.get("FUNDING_WALLET_MNEMONIC_V2") ?? config.get("FUNDING_WALLET_MNEMONIC"));

    const v1DerivedWalletFactory: WalletFactory = (walletIndex?: number) => {
      return new Wallet(config.get("DERIVATION_WALLET_MNEMONIC_V1") ?? config.get("OLD_MASTER_WALLET_MNEMONIC"), walletIndex ?? 0);
    };

    const v2DerivedWalletFactory: WalletFactory = (walletIndex?: number) => {
      return new Wallet(config.get("DERIVATION_WALLET_MNEMONIC_V2") ?? config.get("DERIVATION_WALLET_MNEMONIC"), walletIndex ?? 0);
    };

    return {
      v1: {
        masterWallet: v1MasterWallet,
        derivedWalletFactory: v1DerivedWalletFactory
      },
      v2: {
        masterWallet: v2MasterWallet,
        derivedWalletFactory: v2DerivedWalletFactory
      }
    };
  })
});

type WalletOptions = {
  walletVersion?: WalletVersion;
};

@singleton()
export class TxManagerService {
  readonly #DEFAULT_WALLET_VERSION: WalletVersion = "v2";

  constructor(
    @inject(WALLET_RESOURCES) private readonly walletResources: WalletResources,
    private readonly logger: LoggerService,
    private readonly externalSignerHttpSdkService: ExternalSignerHttpSdkService
  ) {
    this.logger.setContext(TxManagerService.name);
  }

  #getWalletResources(options?: WalletOptions): WalletVersionConfig {
    const version = options?.walletVersion ?? this.#DEFAULT_WALLET_VERSION;
    const { [version]: resources } = this.walletResources;
    return resources;
  }

  async signAndBroadcastWithFundingWallet(messages: readonly EncodeObject[]) {
    return await this.externalSignerHttpSdkService.signAndBroadcastWithFundingWallet(messages);
  }

  async getFundingWalletAddress() {
    const { masterWallet } = this.#getWalletResources();
    return await masterWallet.getFirstAddress();
  }

  async signAndBroadcastWithDerivedWallet(derivationIndex: number, messages: readonly EncodeObject[], options?: SignAndBroadcastOptions) {
    return await this.externalSignerHttpSdkService.signAndBroadcastWithDerivedWallet(derivationIndex, messages, options);
  }

  async getDerivedWalletAddress(index: number, options?: WalletOptions) {
    return await this.getDerivedWallet(index, options).getFirstAddress();
  }

  getDerivedWallet(index: number, options?: WalletOptions) {
    const { derivedWalletFactory } = this.#getWalletResources(options);
    return derivedWalletFactory(index);
  }
}
