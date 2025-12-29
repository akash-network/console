import { EncodeObject } from "@cosmjs/proto-signing";
import { container, inject, type InjectionToken, instancePerContainerCachingFactory, singleton } from "tsyringe";

import { BatchSigningClientService, SignAndBroadcastOptions } from "@src/billing/lib/batch-signing-client/batch-signing-client.service";
import { createSigningStargateClient } from "@src/billing/lib/signing-stargate-client-factory/signing-stargate-client.factory";
import { Wallet } from "@src/billing/lib/wallet/wallet";
import { TYPE_REGISTRY } from "@src/billing/providers/type-registry.provider";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { LoggerService } from "@src/core";

export type BatchSigningClientServiceFactory = (wallet: Wallet, loggerContext?: string) => BatchSigningClientService;
const BATCH_SIGNING_CLIENT_FACTORY: InjectionToken<BatchSigningClientServiceFactory> = Symbol("BATCH_SIGNING_CLIENT_FACTORY");
container.register(BATCH_SIGNING_CLIENT_FACTORY, {
  useFactory: c => {
    return (wallet: Wallet, loggerContext?: string) => {
      return new BatchSigningClientService(c.resolve(BillingConfigService), wallet, c.resolve(TYPE_REGISTRY), createSigningStargateClient, loggerContext);
    };
  }
});

export type WalletFactory = (walletIndex?: number) => Wallet;
type WalletVersionConfig = {
  masterWallet: Wallet;
  masterSigningClient: BatchSigningClientService;
  derivedWalletFactory: WalletFactory;
};

type WalletVersion = "v1" | "v2";
type WalletResources = Record<WalletVersion, WalletVersionConfig>;

const WALLET_RESOURCES: InjectionToken<WalletResources> = Symbol("WALLET_RESOURCES");

container.register(WALLET_RESOURCES, {
  useFactory: instancePerContainerCachingFactory(c => {
    const config = c.resolve(BillingConfigService);
    const batchSigningClientFactory = c.resolve<BatchSigningClientServiceFactory>(BATCH_SIGNING_CLIENT_FACTORY);

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
        masterSigningClient: batchSigningClientFactory(v1MasterWallet, "V1_MASTER_SIGNING_CLIENT"),
        derivedWalletFactory: v1DerivedWalletFactory
      },
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

type WalletOptions = {
  walletVersion?: WalletVersion;
};

@singleton()
export class TxManagerService {
  readonly #clientsByAddress: Map<string, CachedClient> = new Map();

  readonly #DEFAULT_WALLET_VERSION: WalletVersion = "v2";

  constructor(
    @inject(WALLET_RESOURCES) private readonly walletResources: WalletResources,
    @inject(BATCH_SIGNING_CLIENT_FACTORY) private readonly batchSigningClientServiceFactory: BatchSigningClientServiceFactory,
    private readonly logger: LoggerService
  ) {
    this.logger.setContext(TxManagerService.name);
  }

  #getWalletResources(options?: WalletOptions): WalletVersionConfig {
    const version = options?.walletVersion ?? this.#DEFAULT_WALLET_VERSION;
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
    const { client, address } = await this.#getClient(derivationIndex);

    try {
      return await client.signAndBroadcast(messages, options);
    } finally {
      if (!client.hasPendingTransactions && this.#clientsByAddress.has(address)) {
        this.logger.debug({ event: "DEDUPE_SIGNING_CLIENT_CLEAN_UP", address });
        this.#clientsByAddress.delete(address);
      }
    }
  }

  async getDerivedWalletAddress(index: number, options?: WalletOptions) {
    return await this.getDerivedWallet(index, options).getFirstAddress();
  }

  async #getClient(derivationIndex: number): Promise<CachedClient> {
    const wallet = this.getDerivedWallet(derivationIndex);
    const address = await wallet.getFirstAddress();

    if (!this.#clientsByAddress.has(address)) {
      this.logger.debug({ event: "DERIVED_SIGNING_CLIENT_CREATE", address });
      this.#clientsByAddress.set(address, {
        address,
        client: this.batchSigningClientServiceFactory(wallet)
      });
    }

    return this.#clientsByAddress.get(address)!;
  }

  getDerivedWallet(index: number, options?: WalletOptions) {
    const { derivedWalletFactory } = this.#getWalletResources(options);
    return derivedWalletFactory(index);
  }
}
