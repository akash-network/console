import type { EncodeObject } from "@cosmjs/proto-signing";
import type { IndexedTx } from "@cosmjs/stargate";
import createError from "http-errors";
import { container, inject, type InjectionToken, instancePerContainerCachingFactory, singleton } from "tsyringe";

import { KmsSigningKey } from "@src/lib/kms-wallet/kms-signing-key";
import { KmsWallet } from "@src/lib/kms-wallet/kms-wallet";
import type { SignAndBroadcastOptions } from "@src/lib/signing-client/signing-client.service";
import { SigningClientService } from "@src/lib/signing-client/signing-client.service";
import { createSigningStargateClient } from "@src/lib/signing-stargate-client-factory/signing-stargate-client.factory";
import { type SigningWallet, Wallet } from "@src/lib/wallet/wallet";
import { KMS_CLIENT } from "@src/providers/kms-client.provider";
import { LoggerService } from "@src/providers/logging.provider";
import { TYPE_REGISTRY } from "@src/providers/type-registry.provider";
import { AppConfigService } from "@src/services/app-config/app-config.service";

export type SigningClientServiceFactory = (wallet: SigningWallet, loggerContext?: string) => SigningClientService;
const SIGNING_CLIENT_FACTORY: InjectionToken<SigningClientServiceFactory> = Symbol("SIGNING_CLIENT_FACTORY");
container.register(SIGNING_CLIENT_FACTORY, {
  useFactory: c => {
    return (wallet: SigningWallet, loggerContext?: string) => {
      const config = c.resolve(AppConfigService);
      const registry = c.resolve(TYPE_REGISTRY);
      const client = createSigningStargateClient(config.get("RPC_NODE_ENDPOINT"), wallet, {
        registry: registry,
        rpcRequestTimeoutMs: config.get("RPC_REQUEST_TIMEOUT_MS"),
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
export type FundingWalletResources = { wallet: SigningWallet; signingClient: SigningClientService };
type WalletVersionConfig = {
  fundingWallets: FundingWalletResources[];
  derivedWalletFactory: WalletFactory;
};

type WalletVersion = "v2";
type WalletResources = Record<WalletVersion, WalletVersionConfig> & { v1DerivedWalletFactory?: WalletFactory };

export type DerivedWalletVersion = "v1" | "v2";

const WALLET_RESOURCES: InjectionToken<WalletResources> = Symbol("WALLET_RESOURCES");

container.register(WALLET_RESOURCES, {
  useFactory: instancePerContainerCachingFactory(c => {
    const config = c.resolve(AppConfigService);
    const signingClientFactory = c.resolve<SigningClientServiceFactory>(SIGNING_CLIENT_FACTORY);

    const v2MasterWallet = new Wallet(config.get("FUNDING_WALLET_MNEMONIC_V2"));
    const kmsWallets = config.get("FUNDING_WALLET_KMS_KEY_VERSIONS").map(keyVersion => new KmsWallet(new KmsSigningKey(c.resolve(KMS_CLIENT), keyVersion)));

    const v2DerivedWalletFactory: WalletFactory = (walletIndex?: number) => {
      return new Wallet(config.get("DERIVATION_WALLET_MNEMONIC_V2"), walletIndex ?? 0);
    };
    const v1DerivationMnemonic = config.get("DERIVATION_WALLET_MNEMONIC_V1");

    return {
      v2: {
        fundingWallets: [
          { wallet: v2MasterWallet, signingClient: signingClientFactory(v2MasterWallet, "V2_MASTER_SIGNING_CLIENT") },
          ...kmsWallets.map(wallet => ({ wallet, signingClient: signingClientFactory(wallet, "KMS_FUNDING_SIGNING_CLIENT") }))
        ],
        derivedWalletFactory: v2DerivedWalletFactory
      },
      v1DerivedWalletFactory: v1DerivationMnemonic ? (walletIndex?: number) => new Wallet(v1DerivationMnemonic, walletIndex ?? 0) : undefined
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

  async signAndBroadcastWithFundingWallet(fundingWalletAddress: string, messages: readonly EncodeObject[]): Promise<IndexedTx> {
    const { fundingWallets } = this.#getWalletResources();
    const addresses = await this.getFundingWalletAddresses();
    const signingWallet = fundingWallets[addresses.indexOf(fundingWalletAddress)];

    if (!signingWallet) {
      throw new Error(`No funding wallet is configured for ${fundingWalletAddress}`);
    }

    return await signingWallet.signingClient.signAndBroadcast(messages);
  }

  async getFundingWalletAddresses(): Promise<string[]> {
    const { fundingWallets } = this.#getWalletResources();
    return await Promise.all(fundingWallets.map(({ wallet }) => wallet.getFirstAddress()));
  }

  async signAndBroadcastWithDerivedWallet(derivationIndex: number, messages: readonly EncodeObject[], options?: SignAndBroadcastOptions): Promise<IndexedTx> {
    const client = this.#getClient(derivationIndex);
    return await client.signAndBroadcast(messages, options);
  }

  async getDerivedWalletAddress(index: number, version: DerivedWalletVersion = "v2"): Promise<string> {
    return await (version === "v1" ? this.#getV1DerivedWallet(index) : this.getDerivedWallet(index)).getFirstAddress();
  }

  #getV1DerivedWallet(index: number): Wallet {
    const { v1DerivedWalletFactory } = this.walletResources;

    if (!v1DerivedWalletFactory) throw createError(501, "This signer holds no seed for the first generation of user wallets");

    return v1DerivedWalletFactory(index);
  }

  #getClient(derivationIndex: number): SigningClientService {
    if (!this.#clientsByDerivationIndex.has(derivationIndex)) {
      const wallet = this.getDerivedWallet(derivationIndex);

      this.logger.debug({ event: "DERIVED_SIGNING_CLIENT_CREATE", derivationIndex });
      this.#clientsByDerivationIndex.set(derivationIndex, this.signingClientServiceFactory(wallet));
    }

    return this.#clientsByDerivationIndex.get(derivationIndex)!;
  }

  getDerivedWallet(index: number): Wallet {
    const { derivedWalletFactory } = this.#getWalletResources();
    return derivedWalletFactory(index);
  }
}
