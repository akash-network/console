import { EncodeObject } from "@cosmjs/proto-signing";
import { container, inject, type InjectionToken, instancePerContainerCachingFactory, singleton } from "tsyringe";

import { BatchSigningClientService, SignAndBroadcastOptions } from "@src/billing/lib/batch-signing-client/batch-signing-client.service";
import { createSigningStargateClient } from "@src/billing/lib/signing-stargate-client-factory/signing-stargate-client.factory";
import { Wallet } from "@src/billing/lib/wallet/wallet";
import { TYPE_REGISTRY } from "@src/billing/providers/type-registry.provider";
import { UserWalletOutput } from "@src/billing/repositories";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { LoggerService } from "@src/core";

type CachedClient = {
  address: string;
  client: BatchSigningClientService;
};

const FUNDING_WALLETS: InjectionToken<Wallet[]> = Symbol("FUNDING_WALLETS");
container.register(FUNDING_WALLETS, {
  useFactory: instancePerContainerCachingFactory(c => {
    const config = c.resolve(BillingConfigService);
    return config.get("FUNDING_WALLET_MNEMONICS").map(mnemonic => new Wallet(mnemonic));
  })
});

const DERIVATION_WALLETS: InjectionToken<Wallet[]> = Symbol("DERIVATION_WALLETS");
container.register(DERIVATION_WALLETS, {
  useFactory: instancePerContainerCachingFactory(c => {
    const config = c.resolve(BillingConfigService);
    return config.get("DERIVATION_WALLET_MNEMONICS").map(mnemonic => new Wallet(mnemonic));
  })
});

export type BatchSigningClientServiceFactory = (wallet: Wallet, loggerContext?: string) => BatchSigningClientService;
const BATCH_SIGNING_CLIENT_FACTORY: InjectionToken<BatchSigningClientServiceFactory> = Symbol("BATCH_SIGNING_CLIENT_FACTORY");
container.register(BATCH_SIGNING_CLIENT_FACTORY, {
  useFactory: c => {
    return (wallet: Wallet, loggerContext?: string) => {
      return new BatchSigningClientService(c.resolve(BillingConfigService), wallet, c.resolve(TYPE_REGISTRY), createSigningStargateClient, loggerContext);
    };
  }
});

export type UserWalletOptions = Pick<UserWalletOutput, "id" | "address" | "fundedBy" | "derivedFrom">;

export type FundingOptions = Pick<UserWalletOptions, "fundedBy">;
export type DerivationOptions = Pick<UserWalletOptions, "id" | "derivedFrom">;

@singleton()
export class TxManagerService {
  readonly #derivationAddressMnemonics: Map<string, string> = new Map();

  readonly #fundingWalletsByAddress: Map<string, Wallet> = new Map();

  readonly #fundingClientsByAddress: Map<string, BatchSigningClientService> = new Map();

  readonly #clientsByAddress: Map<string, CachedClient> = new Map();

  #primaryDerivingWalletAddress: string | undefined;

  #primaryFundingWalletAddress: string | undefined;

  #isInitialized: Promise<void>;

  constructor(
    @inject(FUNDING_WALLETS) private readonly fundingWallets: Wallet[],
    @inject(DERIVATION_WALLETS) private readonly derivationWallets: Wallet[],
    @inject(BATCH_SIGNING_CLIENT_FACTORY) private readonly batchSigningClientServiceFactory: BatchSigningClientServiceFactory,
    private readonly billingConfigService: BillingConfigService,
    private readonly logger: LoggerService
  ) {
    this.logger.setContext(TxManagerService.name);

    this.#isInitialized = this.#init();
  }

  async #init() {
    if (this.fundingWallets.length === 0) {
      throw new Error("At least one funding wallet is required");
    }

    if (this.derivationWallets.length === 0) {
      throw new Error("At least one derivation wallet is required");
    }

    await Promise.all(
      this.fundingWallets.map(async (wallet, index) => {
        const address = await wallet.getFirstAddress();
        this.#fundingWalletsByAddress.set(address, wallet);
        this.#fundingClientsByAddress.set(address, this.batchSigningClientServiceFactory(wallet, `FUNDING_SIGNING_CLIENT_${address}`));

        if (index === 0) {
          this.#primaryFundingWalletAddress = address;
        }
      })
    );

    await Promise.all(
      this.derivationWallets.map(async (wallet, index) => {
        const address = await wallet.getFirstAddress();
        this.#derivationAddressMnemonics.set(address, await wallet.getMnemonic());

        if (index === 0) {
          this.#primaryDerivingWalletAddress = address;
        }
      })
    );
  }

  async signAndBroadcastWithFundingWallet(fundingOptions: FundingOptions, messages: readonly EncodeObject[]) {
    await this.#isInitialized;
    const client = this.#fundingClientsByAddress.get(fundingOptions.fundedBy ?? this.billingConfigService.get("FALLBACK_FUNDING_WALLET_ADDRESS"));

    if (!client) {
      throw new Error(`Funding client not found for address: ${fundingOptions.fundedBy ?? this.billingConfigService.get("FALLBACK_FUNDING_WALLET_ADDRESS")}`);
    }

    return await client.signAndBroadcast(messages);
  }

  async getFundingWalletAddress(fundingOptions: FundingOptions) {
    await this.#isInitialized;
    const address = fundingOptions.fundedBy ?? this.billingConfigService.get("FALLBACK_FUNDING_WALLET_ADDRESS");
    const wallet = this.#fundingWalletsByAddress.get(address);

    if (!wallet) {
      throw new Error(`Funding wallet not found for address: ${address}`);
    }

    return address;
  }

  async getPrimaryFundingWalletAddress() {
    await this.#isInitialized;
    return this.#primaryFundingWalletAddress!;
  }

  async signAndBroadcastWithDerivedWallet(derivationOptions: DerivationOptions, messages: readonly EncodeObject[], options?: SignAndBroadcastOptions) {
    const { client, address } = await this.#getClient(derivationOptions);

    try {
      return await client.signAndBroadcast(messages, options);
    } finally {
      if (!client.hasPendingTransactions && this.#clientsByAddress.has(address)) {
        this.logger.debug({ event: "DEDUPE_SIGNING_CLIENT_CLEAN_UP", address });
        this.#clientsByAddress.delete(address);
      }
    }
  }

  async getDerivedWalletAddress(derivationOptions: DerivationOptions) {
    const wallet = await this.getDerivedWallet(derivationOptions);
    return await wallet.getFirstAddress();
  }

  async initDerivedWalletAddress(derivationOptions: Pick<DerivationOptions, "id">) {
    await this.#isInitialized;
    const derivedFrom = this.#primaryDerivingWalletAddress!;
    const fundedBy = this.#primaryFundingWalletAddress!;
    const wallet = await this.getDerivedWallet({ ...derivationOptions, derivedFrom });

    return {
      address: await wallet.getFirstAddress(),
      fundedBy,
      derivedFrom
    };
  }

  async #getClient(derivationOptions: DerivationOptions): Promise<CachedClient> {
    const wallet = await this.getDerivedWallet(derivationOptions);
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

  async getDerivedWallet(derivationOptions: DerivationOptions) {
    await this.#isInitialized;

    const address = derivationOptions.derivedFrom ?? this.billingConfigService.get("FALLBACK_DERIVATION_WALLET_ADDRESS");
    const mnemonic = this.#derivationAddressMnemonics.get(address);

    if (!mnemonic) {
      throw new Error(`Derivation wallet not found for address: ${address}`);
    }

    return new Wallet(mnemonic);
  }
}
