import type { EncodeObject } from "@cosmjs/proto-signing";
import { container, inject, type InjectionToken, instancePerContainerCachingFactory, singleton } from "tsyringe";

import type { SignAndBroadcastOptions } from "@src/lib/batch-signing-client/batch-signing-client.service";
import { BatchSigningClientService } from "@src/lib/batch-signing-client/batch-signing-client.service";
import { createSigningStargateClient } from "@src/lib/signing-stargate-client-factory/signing-stargate-client.factory";
import { Wallet } from "@src/lib/wallet/wallet";
// eslint-disable-next-line
import { LoggerService } from "@src/providers/logging.provider";
import { TYPE_REGISTRY } from "@src/providers/type-registry.provider";
import { AppConfigService } from "@src/services/app-config/app-config.service";

export type BatchSigningClientServiceFactory = (wallet: Wallet, loggerContext?: string) => BatchSigningClientService;
const BATCH_SIGNING_CLIENT_FACTORY: InjectionToken<BatchSigningClientServiceFactory> = Symbol("BATCH_SIGNING_CLIENT_FACTORY");
container.register(BATCH_SIGNING_CLIENT_FACTORY, {
  useFactory: c => {
    return (wallet: Wallet, loggerContext?: string) => {
      return new BatchSigningClientService(c.resolve(AppConfigService), wallet, c.resolve(TYPE_REGISTRY), createSigningStargateClient, loggerContext);
    };
  }
});

export type WalletFactory = (walletIndex?: number) => Wallet;
type WalletVersionConfig = {
  masterWallet: Wallet;
  masterSigningClient: BatchSigningClientService;
  derivedWalletFactory: WalletFactory;
};

type WalletVersion = "v2";
type WalletResources = Record<WalletVersion, WalletVersionConfig>;

const WALLET_RESOURCES: InjectionToken<WalletResources> = Symbol("WALLET_RESOURCES");

container.register(WALLET_RESOURCES, {
  useFactory: instancePerContainerCachingFactory(c => {
    const config = c.resolve(AppConfigService);
    const batchSigningClientFactory = c.resolve<BatchSigningClientServiceFactory>(BATCH_SIGNING_CLIENT_FACTORY);

    const v2MasterWallet = new Wallet(config.get("FUNDING_WALLET_MNEMONIC_V2"));

    const v2DerivedWalletFactory: WalletFactory = (walletIndex?: number) => {
      return new Wallet(config.get("DERIVATION_WALLET_MNEMONIC_V2"), walletIndex ?? 0);
    };

    return {
      v2: {
        masterWallet: v2MasterWallet,
        masterSigningClient: batchSigningClientFactory(v2MasterWallet, "V2_MASTER_SIGNING_CLIENT"),
        derivedWalletFactory: v2DerivedWalletFactory
      }
    };
  })
});

type CachedClient = {
  address: string;
  client: BatchSigningClientService;
};

@singleton()
export class TxManagerService {
  readonly #clientsByDerivationIndex: Map<number, CachedClient> = new Map();
  readonly #DEFAULT_WALLET_VERSION: WalletVersion = "v2";

  constructor(
    @inject(WALLET_RESOURCES) private readonly walletResources: WalletResources,
    @inject(BATCH_SIGNING_CLIENT_FACTORY) private readonly batchSigningClientServiceFactory: BatchSigningClientServiceFactory,
    @inject(LoggerService) private readonly logger: LoggerService
  ) {
    this.logger.setContext(TxManagerService.name);
  }

  #getWalletResources(): WalletVersionConfig {
    const version = this.#DEFAULT_WALLET_VERSION;
    const { [version]: resources } = this.walletResources;
    return resources;
  }

  async signAndBroadcastWithFundingWallet(messages: readonly EncodeObject[]) {
    const { masterSigningClient } = this.#getWalletResources();
    return await masterSigningClient.signAndBroadcast(messages);
  }

  async getFundingWalletAddress() {
    const { masterWallet } = this.#getWalletResources();
    return await masterWallet.getFirstAddress();
  }

  async signAndBroadcastWithDerivedWallet(derivationIndex: number, messages: readonly EncodeObject[], options?: SignAndBroadcastOptions) {
    const { client } = await this.#getClient(derivationIndex);

    try {
      return await client.signAndBroadcast(messages, options);
    } finally {
      if (!client.hasPendingTransactions && this.#clientsByDerivationIndex.has(derivationIndex)) {
        this.logger.debug({ event: "DEDUPE_SIGNING_CLIENT_CLEAN_UP", derivationIndex });
        this.#clientsByDerivationIndex.delete(derivationIndex);
      }
    }
  }

  async getDerivedWalletAddress(index: number) {
    return await this.getDerivedWallet(index).getFirstAddress();
  }

  async #getClient(derivationIndex: number): Promise<CachedClient> {
    if (!this.#clientsByDerivationIndex.has(derivationIndex)) {
      const wallet = this.getDerivedWallet(derivationIndex);
      const address = await wallet.getFirstAddress();

      this.logger.debug({ event: "DERIVED_SIGNING_CLIENT_CREATE", derivationIndex });
      this.#clientsByDerivationIndex.set(derivationIndex, {
        address,
        client: this.batchSigningClientServiceFactory(wallet)
      });
    }

    return this.#clientsByDerivationIndex.get(derivationIndex)!;
  }

  getDerivedWallet(index: number) {
    const { derivedWalletFactory } = this.#getWalletResources();
    return derivedWalletFactory(index);
  }
}
