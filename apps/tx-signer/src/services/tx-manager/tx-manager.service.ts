import type { EncodeObject } from "@cosmjs/proto-signing";
import type { IndexedTx } from "@cosmjs/stargate";
import createError from "http-errors";
import { container, inject, type InjectionToken, instancePerContainerCachingFactory, singleton } from "tsyringe";

import { KmsSigningKey } from "@src/lib/kms-wallet/kms-signing-key";
import { KmsWallet } from "@src/lib/kms-wallet/kms-wallet";
import { ADDRESS_ONLY_SEED_VERSIONS, DEFAULT_SEED_VERSION } from "@src/lib/seed-version/seed-version";
import type { SignAndBroadcastOptions } from "@src/lib/signing-client/signing-client.service";
import { SigningClientService } from "@src/lib/signing-client/signing-client.service";
import { createSigningStargateClient } from "@src/lib/signing-stargate-client-factory/signing-stargate-client.factory";
import { type SigningWallet, Wallet } from "@src/lib/wallet/wallet";
import { KMS_CLIENT } from "@src/providers/kms-client.provider";
import { LoggerService } from "@src/providers/logging.provider";
import { TYPE_REGISTRY } from "@src/providers/type-registry.provider";
import { AppConfigService } from "@src/services/app-config/app-config.service";
import { DerivationSeedService } from "@src/services/derivation-seed/derivation-seed.service";

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

export type FundingWalletResources = { wallet: SigningWallet; signingClient: SigningClientService };
type WalletResources = { fundingWallets: FundingWalletResources[] };

const WALLET_RESOURCES: InjectionToken<WalletResources> = Symbol("WALLET_RESOURCES");

container.register(WALLET_RESOURCES, {
  useFactory: instancePerContainerCachingFactory(c => {
    const config = c.resolve(AppConfigService);
    const signingClientFactory = c.resolve<SigningClientServiceFactory>(SIGNING_CLIENT_FACTORY);

    const v2MasterWallet = new Wallet(config.get("FUNDING_WALLET_MNEMONIC_V2"));
    const kmsWallets = config.get("FUNDING_WALLET_KMS_KEY_VERSIONS").map(keyVersion => new KmsWallet(new KmsSigningKey(c.resolve(KMS_CLIENT), keyVersion)));

    return {
      fundingWallets: [
        { wallet: v2MasterWallet, signingClient: signingClientFactory(v2MasterWallet, "V2_MASTER_SIGNING_CLIENT") },
        ...kmsWallets.map(wallet => ({ wallet, signingClient: signingClientFactory(wallet, "KMS_FUNDING_SIGNING_CLIENT") }))
      ]
    };
  })
});

@singleton()
export class TxManagerService {
  readonly #clientsByDerivedWallet: Map<string, SigningClientService> = new Map();

  constructor(
    @inject(WALLET_RESOURCES) private readonly walletResources: WalletResources,
    @inject(SIGNING_CLIENT_FACTORY) private readonly signingClientServiceFactory: SigningClientServiceFactory,
    @inject(DerivationSeedService) private readonly derivationSeedService: DerivationSeedService,
    @inject(LoggerService) private readonly logger: LoggerService
  ) {
    this.logger.setContext(TxManagerService.name);
  }

  async signAndBroadcastWithFundingWallet(fundingWalletAddress: string, messages: readonly EncodeObject[]): Promise<IndexedTx> {
    const { fundingWallets } = this.walletResources;
    const addresses = await this.getFundingWalletAddresses();
    const signingWallet = fundingWallets[addresses.indexOf(fundingWalletAddress)];

    if (!signingWallet) {
      throw new Error(`No funding wallet is configured for ${fundingWalletAddress}`);
    }

    return await signingWallet.signingClient.signAndBroadcast(messages);
  }

  async getFundingWalletAddresses(): Promise<string[]> {
    const { fundingWallets } = this.walletResources;
    return await Promise.all(fundingWallets.map(({ wallet }) => wallet.getFirstAddress()));
  }

  async signAndBroadcastWithDerivedWallet(
    derivationIndex: number,
    messages: readonly EncodeObject[],
    options?: SignAndBroadcastOptions,
    seedVersion: string = DEFAULT_SEED_VERSION
  ): Promise<IndexedTx> {
    const client = this.#getClient(derivationIndex, seedVersion);
    return await client.signAndBroadcast(messages, options);
  }

  async getDerivedWalletAddress(index: number, seedVersion: string = DEFAULT_SEED_VERSION): Promise<string> {
    return await this.derivationSeedService.deriveWallet(index, seedVersion).getFirstAddress();
  }

  #getClient(derivationIndex: number, seedVersion: string): SigningClientService {
    const derivedWalletKey = `${seedVersion}/${derivationIndex}`;

    if (!this.#clientsByDerivedWallet.has(derivedWalletKey)) {
      const wallet = this.getDerivedWallet(derivationIndex, seedVersion);

      this.logger.debug({ event: "DERIVED_SIGNING_CLIENT_CREATE", derivationIndex, seedVersion });
      this.#clientsByDerivedWallet.set(derivedWalletKey, this.signingClientServiceFactory(wallet));
    }

    return this.#clientsByDerivedWallet.get(derivedWalletKey)!;
  }

  /** The wallet to sign with, which is why a seed version kept for addresses only is refused here and not when an address is read. */
  getDerivedWallet(index: number, seedVersion: string = DEFAULT_SEED_VERSION): Wallet {
    if (ADDRESS_ONLY_SEED_VERSIONS.has(seedVersion)) {
      throw createError(403, `Derivation seed ${seedVersion} only answers addresses, so nothing is signed with it`);
    }

    return this.derivationSeedService.deriveWallet(index, seedVersion);
  }
}
