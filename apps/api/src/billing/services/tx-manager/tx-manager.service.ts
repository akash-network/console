import type { EncodeObject } from "@cosmjs/proto-signing";
import { container, inject, type InjectionToken, instancePerContainerCachingFactory, singleton } from "tsyringe";

import type { SignAndBroadcastOptions } from "@src/billing/lib/batch-signing-client/batch-signing-client.service";
import { Wallet } from "@src/billing/lib/wallet/wallet";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import {
  ExternalSignerHttpSdkService,
  type SignAndBroadcastFundingOptions
} from "@src/billing/services/external-signer-http-sdk/external-signer-http-sdk.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";

export type WalletFactory = (walletIndex: number) => Wallet;
type WalletVersion = "v1" | "v2";

/** A wallet or factory missing here is a seed phrase this process does not hold, so the signer answers for it. */
export type WalletResources = {
  fundingWallet?: Wallet;
  derivedWalletFactories: Partial<Record<WalletVersion, WalletFactory>>;
};

type WalletSeedPhrases = { funding?: string; derivation: Partial<Record<WalletVersion, string>> };

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
  walletVersion?: WalletVersion;
};

@singleton()
export class TxManagerService {
  readonly #DEFAULT_WALLET_VERSION: WalletVersion = "v2";

  #fundingWalletAddressFromSigner?: Promise<string>;

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    @inject(WALLET_RESOURCES) private readonly walletResources: WalletResources,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger,
    private readonly externalSignerHttpSdkService: ExternalSignerHttpSdkService
  ) {
    this.logger = createLogger({ context: TxManagerService.name });
  }

  /** Without the derivation seed nothing here can sign in a user wallet's name, and only the signer can. */
  get holdsDerivationSeed(): boolean {
    return !!this.walletResources.derivedWalletFactories[this.#DEFAULT_WALLET_VERSION];
  }

  async signAndBroadcastWithFundingWallet(messages: readonly EncodeObject[], options?: SignAndBroadcastFundingOptions) {
    return await this.externalSignerHttpSdkService.signAndBroadcastWithFundingWallet(messages, options);
  }

  async getFundingWalletAddress(): Promise<string> {
    const { fundingWallet } = this.walletResources;

    return fundingWallet ? await fundingWallet.getFirstAddress() : await this.#getFundingWalletAddressFromSigner();
  }

  async #getFundingWalletAddressFromSigner(): Promise<string> {
    const asked = (this.#fundingWalletAddressFromSigner ??= this.#askSignerForFundingWalletAddress());

    try {
      return await asked;
    } catch (error) {
      if (this.#fundingWalletAddressFromSigner === asked) this.#fundingWalletAddressFromSigner = undefined;
      throw error;
    }
  }

  async #askSignerForFundingWalletAddress(): Promise<string> {
    const [seedPhraseWalletAddress] = await this.externalSignerHttpSdkService.getFundingWalletAddresses();

    if (!seedPhraseWalletAddress) throw new Error("The signer named no funding wallet");

    return seedPhraseWalletAddress;
  }

  async signAndBroadcastWithDerivedWallet(derivationIndex: number, messages: readonly EncodeObject[], options?: SignAndBroadcastOptions) {
    return await this.externalSignerHttpSdkService.signAndBroadcastWithDerivedWallet(derivationIndex, messages, options);
  }

  async getDerivedWalletAddress(index: number, options?: WalletOptions): Promise<string> {
    const version = options?.walletVersion ?? this.#DEFAULT_WALLET_VERSION;
    const derivedWalletFactory = this.walletResources.derivedWalletFactories[version];

    return derivedWalletFactory
      ? await derivedWalletFactory(index).getFirstAddress()
      : await this.externalSignerHttpSdkService.getDerivedWalletAddress(index, version);
  }

  getDerivedWallet(index: number): Wallet {
    const derivedWalletFactory = this.walletResources.derivedWalletFactories[this.#DEFAULT_WALLET_VERSION];

    if (!derivedWalletFactory) throw new Error("This process holds no derivation seed, so only the signer can sign for a user wallet");

    return derivedWalletFactory(index);
  }
}
