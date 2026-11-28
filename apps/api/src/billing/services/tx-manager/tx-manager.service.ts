import type { EncodeObject } from "@cosmjs/proto-signing";
import { container, inject, type InjectionToken, instancePerContainerCachingFactory, singleton } from "tsyringe";

import type { SignAndBroadcastOptions } from "@src/billing/lib/batch-signing-client/batch-signing-client.service";
import { Wallet } from "@src/billing/lib/wallet/wallet";
import { UserWalletRepository } from "@src/billing/repositories/user-wallet/user-wallet.repository";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import {
  ExternalSignerHttpSdkService,
  type SignAndBroadcastFundingOptions
} from "@src/billing/services/external-signer-http-sdk/external-signer-http-sdk.service";
import MemoryCacheEngine from "@src/caching/memoryCacheEngine";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";

export type WalletFactory = (walletIndex: number) => Wallet;

/** A wallet or factory missing here is a seed phrase this process does not hold, so the signer answers for it. */
export type WalletResources = {
  fundingWallet?: Wallet;
  derivedWalletFactories: Partial<Record<string, WalletFactory>>;
};

type WalletSeedPhrases = { funding?: string; derivation: Partial<Record<string, string>> };

const MAX_REMEMBERED_SEED_VERSIONS = 50_000;

/** `new Wallet(undefined)` generates a random wallet, so a seed phrase that is not configured must never reach it. */
export function createWalletResources({ funding, derivation }: WalletSeedPhrases): WalletResources {
  const derivedWalletFactoryOf = (seedPhrase?: string): WalletFactory | undefined => {
    return seedPhrase ? walletIndex => new Wallet(seedPhrase, walletIndex) : undefined;
  };

  return {
    fundingWallet: funding ? new Wallet(funding) : undefined,
    derivedWalletFactories: { v1: derivedWalletFactoryOf(derivation.v1), v2: derivedWalletFactoryOf(derivation.v2) }
  };
}

const WALLET_RESOURCES: InjectionToken<WalletResources> = Symbol("WALLET_RESOURCES");

container.register(WALLET_RESOURCES, {
  useFactory: instancePerContainerCachingFactory(c => {
    const config = c.resolve(BillingConfigService);

    return createWalletResources({
      funding: config.get("FUNDING_WALLET_MNEMONIC_V2") ?? config.get("FUNDING_WALLET_MNEMONIC"),
      derivation: {
        v1: config.get("DERIVATION_WALLET_MNEMONIC_V1") ?? config.get("OLD_MASTER_WALLET_MNEMONIC"),
        v2: config.get("DERIVATION_WALLET_MNEMONIC_V2") ?? config.get("DERIVATION_WALLET_MNEMONIC")
      }
    });
  })
});

type WalletOptions = {
  walletVersion?: string;
};

@singleton()
export class TxManagerService {
  /** A wallet never changes seed, so a version read once holds for as long as the row exists. */
  readonly #seedVersionsByWalletId = new MemoryCacheEngine({ maxEntries: MAX_REMEMBERED_SEED_VERSIONS, name: "TxManagerService#seedVersion" });

  #fundingWalletAddressFromSigner?: Promise<string>;

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    @inject(WALLET_RESOURCES) private readonly walletResources: WalletResources,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger,
    private readonly externalSignerHttpSdkService: ExternalSignerHttpSdkService,
    private readonly userWalletRepository: UserWalletRepository
  ) {
    this.logger = createLogger({ context: TxManagerService.name });
  }

  /** Without the seed a wallet was derived from nothing here can sign in its name, and only the signer can. */
  holdsDerivationSeed(seedVersion: string): boolean {
    return !!this.walletResources.derivedWalletFactories[seedVersion];
  }

  /** The seed version the wallet row records, which is the wallet's derivation index together with its id. */
  async getSeedVersion(walletId: number): Promise<string> {
    const cacheKey = String(walletId);
    const remembered = this.#seedVersionsByWalletId.getFromCache<string>(cacheKey);

    if (remembered) return remembered;

    const seedVersion = await this.userWalletRepository.findSeedVersionById(walletId);

    if (!seedVersion) throw new Error(`Wallet ${walletId} does not exist, so the seed it was derived from is unknown`);

    this.#seedVersionsByWalletId.storeInCache(cacheKey, seedVersion);

    return seedVersion;
  }

  async signAndBroadcastWithFundingWallet(messages: readonly EncodeObject[], options?: SignAndBroadcastFundingOptions) {
    const grantee = options && (await this.#toDerivedWalletRef(options.granteeDerivationIndex));

    return await this.externalSignerHttpSdkService.signAndBroadcastWithFundingWallet(messages, grantee);
  }

  async #toDerivedWalletRef(derivationIndex: number) {
    return { derivationIndex, seedVersion: await this.getSeedVersion(derivationIndex) };
  }

  async getFundingWalletAddress(): Promise<string> {
    const { fundingWallet } = this.walletResources;

    return fundingWallet ? await fundingWallet.getFirstAddress() : await this.#getFundingWalletAddressFromSigner();
  }

  async #getFundingWalletAddressFromSigner(): Promise<string> {
    this.#fundingWalletAddressFromSigner ??= this.#askSignerForFundingWalletAddress();

    try {
      return await this.#fundingWalletAddressFromSigner;
    } catch (error) {
      this.#fundingWalletAddressFromSigner = undefined;
      throw error;
    }
  }

  async #askSignerForFundingWalletAddress(): Promise<string> {
    const [seedPhraseWalletAddress] = await this.externalSignerHttpSdkService.getFundingWalletAddresses();

    if (!seedPhraseWalletAddress) throw new Error("The signer named no funding wallet");

    return seedPhraseWalletAddress;
  }

  async signAndBroadcastWithDerivedWallet(derivationIndex: number, messages: readonly EncodeObject[], options?: SignAndBroadcastOptions) {
    return await this.externalSignerHttpSdkService.signAndBroadcastWithDerivedWallet(await this.#toDerivedWalletRef(derivationIndex), messages, options);
  }

  async getDerivedWalletAddress(index: number, options?: WalletOptions): Promise<string> {
    const seedVersion = options?.walletVersion ?? (await this.getSeedVersion(index));
    const derivedWalletFactory = this.walletResources.derivedWalletFactories[seedVersion];

    return derivedWalletFactory
      ? await derivedWalletFactory(index).getFirstAddress()
      : await this.externalSignerHttpSdkService.getDerivedWalletAddress({ derivationIndex: index, seedVersion });
  }

  getDerivedWallet(index: number, seedVersion: string): Wallet {
    const derivedWalletFactory = this.walletResources.derivedWalletFactories[seedVersion];

    if (!derivedWalletFactory) throw new Error(`This process holds no derivation seed ${seedVersion}, so only the signer can sign for a wallet made from it`);

    return derivedWalletFactory(index);
  }
}
