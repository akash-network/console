import type { EncodeObject } from "@cosmjs/proto-signing";
import { container, inject, type InjectionToken, instancePerContainerCachingFactory, singleton } from "tsyringe";

import type { SignAndBroadcastOptions } from "@src/lib/signing-client/signing-client.service";
import { SigningClientService } from "@src/lib/signing-client/signing-client.service";
import { createSigningStargateClient } from "@src/lib/signing-stargate-client-factory/signing-stargate-client.factory";
import { Wallet } from "@src/lib/wallet/wallet";
// eslint-disable-next-line
import { LoggerService } from "@src/providers/logging.provider";
import { TYPE_REGISTRY } from "@src/providers/type-registry.provider";
import { AppConfigService } from "@src/services/app-config/app-config.service";

export type SigningClientServiceFactory = (wallet: Wallet, loggerContext?: string) => SigningClientService;
const SIGNING_CLIENT_FACTORY: InjectionToken<SigningClientServiceFactory> = Symbol("SIGNING_CLIENT_FACTORY");
container.register(SIGNING_CLIENT_FACTORY, {
  useFactory: c => {
    return (wallet: Wallet, loggerContext?: string) => {
      const config = c.resolve(AppConfigService);
      const registry = c.resolve(TYPE_REGISTRY);
      const client = createSigningStargateClient(config.get("RPC_NODE_ENDPOINT"), wallet, {
        registry: registry,
        signConfig: {
          ttlMs: config.get("UNORDERED_TX_TTL_MS"),
          gasMultiplier: config.get("GAS_DEFAULT_MULTIPLIER"),
          averageGasPrice: config.get("AVERAGE_GAS_PRICE")
        }
      });
      return new SigningClientService(client, config, loggerContext);
    };
  }
});

export type WalletFactory = (walletIndex?: number) => Wallet;
type WalletVersionConfig = {
  masterWallet: Wallet;
  masterSigningClient: SigningClientService;
  derivedWalletFactory: WalletFactory;
};

type WalletVersion = "v2";
type WalletResources = Record<WalletVersion, WalletVersionConfig>;

const WALLET_RESOURCES: InjectionToken<WalletResources> = Symbol("WALLET_RESOURCES");

container.register(WALLET_RESOURCES, {
  useFactory: instancePerContainerCachingFactory(c => {
    const config = c.resolve(AppConfigService);
    const signingClientFactory = c.resolve<SigningClientServiceFactory>(SIGNING_CLIENT_FACTORY);

    const v2MasterWallet = new Wallet(config.get("FUNDING_WALLET_MNEMONIC_V2"));

    const v2DerivedWalletFactory: WalletFactory = (walletIndex?: number) => {
      return new Wallet(config.get("DERIVATION_WALLET_MNEMONIC_V2"), walletIndex ?? 0);
    };

    return {
      v2: {
        masterWallet: v2MasterWallet,
        masterSigningClient: signingClientFactory(v2MasterWallet, "V2_MASTER_SIGNING_CLIENT"),
        derivedWalletFactory: v2DerivedWalletFactory
      }
    };
  })
});

@singleton()
export class TxManagerService {
  readonly #clientsByDerivationIndex: Map<number, SigningClientService> = new Map();
  readonly #DEFAULT_WALLET_VERSION: WalletVersion = "v2";

  constructor(
    @inject(WALLET_RESOURCES) private readonly walletResources: WalletResources,
    @inject(SIGNING_CLIENT_FACTORY) private readonly signingClientServiceFactory: SigningClientServiceFactory,
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
    const client = this.#getClient(derivationIndex);
    return await client.signAndBroadcast(messages, options);
  }

  async getDerivedWalletAddress(index: number) {
    return await this.getDerivedWallet(index).getFirstAddress();
  }

  #getClient(derivationIndex: number): SigningClientService {
    if (!this.#clientsByDerivationIndex.has(derivationIndex)) {
      const wallet = this.getDerivedWallet(derivationIndex);

      this.logger.debug({ event: "DERIVED_SIGNING_CLIENT_CREATE", derivationIndex });
      this.#clientsByDerivationIndex.set(derivationIndex, this.signingClientServiceFactory(wallet));
    }

    return this.#clientsByDerivationIndex.get(derivationIndex)!;
  }

  getDerivedWallet(index: number) {
    const { derivedWalletFactory } = this.#getWalletResources();
    return derivedWalletFactory(index);
  }
}
