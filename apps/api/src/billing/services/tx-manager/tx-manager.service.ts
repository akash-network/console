import { EncodeObject } from "@cosmjs/proto-signing";
import { container, inject, type InjectionToken, instancePerContainerCachingFactory, singleton } from "tsyringe";

import { BatchSigningClientService, SignAndBroadcastOptions } from "@src/billing/lib/batch-signing-client/batch-signing-client.service";
import { createSigningStargateClient } from "@src/billing/lib/signing-stargate-client-factory/signing-stargate-client.factory";
import { Wallet } from "@src/billing/lib/wallet/wallet";
import { TYPE_REGISTRY } from "@src/billing/providers/type-registry.provider";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { LoggerService } from "@src/core";

type CachedClient = {
  address: string;
  client: BatchSigningClientService;
};

const FUNDING_WALLET: InjectionToken<Wallet> = Symbol("FUNDING_WALLET");
container.register(FUNDING_WALLET, {
  useFactory: instancePerContainerCachingFactory(c => {
    const config = c.resolve(BillingConfigService);
    return new Wallet(config.get("FUNDING_WALLET_MNEMONIC"), config.get("FUNDING_WALLET_INDEX"));
  })
});

const OLD_MASTER_WALLET: InjectionToken<Wallet> = Symbol("OLD_MASTER_WALLET");
container.register(OLD_MASTER_WALLET, {
  useFactory: instancePerContainerCachingFactory(c => {
    const config = c.resolve(BillingConfigService);
    return new Wallet(config.get("OLD_MASTER_WALLET_MNEMONIC"), 0);
  })
});

export type WalletFactory = (walletIndex?: number) => Wallet;
const DERIVED_WALLET_FACTORY: InjectionToken<WalletFactory> = Symbol("DERIVED_WALLET_FACTORY");
container.register(DERIVED_WALLET_FACTORY, {
  useFactory: c => {
    return (walletIndex: number) => new Wallet(c.resolve(BillingConfigService).get("DERIVATION_WALLET_MNEMONIC"), walletIndex);
  }
});

const OLD_DERIVED_WALLET_FACTORY: InjectionToken<WalletFactory> = Symbol("OLD_DERIVED_WALLET_FACTORY");
container.register(OLD_DERIVED_WALLET_FACTORY, {
  useFactory: c => {
    return (walletIndex: number) => new Wallet(c.resolve(BillingConfigService).get("OLD_MASTER_WALLET_MNEMONIC"), walletIndex);
  }
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

const FUNDING_SIGNING_CLIENT: InjectionToken<BatchSigningClientService> = Symbol("FUNDING_SIGNING_CLIENT");
container.register(FUNDING_SIGNING_CLIENT, {
  useFactory: instancePerContainerCachingFactory(c => {
    const factory = c.resolve<BatchSigningClientServiceFactory>(BATCH_SIGNING_CLIENT_FACTORY);
    return factory(c.resolve(FUNDING_WALLET), "FUNDING_SIGNING_CLIENT");
  })
});

const OLD_MASTER_SIGNING_CLIENT: InjectionToken<BatchSigningClientService> = Symbol("OLD_MASTER_SIGNING_CLIENT");
container.register(OLD_MASTER_SIGNING_CLIENT, {
  useFactory: instancePerContainerCachingFactory(c => {
    const factory = c.resolve<BatchSigningClientServiceFactory>(BATCH_SIGNING_CLIENT_FACTORY);
    return factory(c.resolve(OLD_MASTER_WALLET), "OLD_MASTER_SIGNING_CLIENT");
  })
});

@singleton()
export class TxManagerService {
  readonly #clientsByAddress: Map<string, CachedClient> = new Map();

  constructor(
    @inject(FUNDING_WALLET) private readonly fundingWallet: Wallet,
    @inject(FUNDING_SIGNING_CLIENT) private readonly fundingSigningClient: BatchSigningClientService,
    @inject(OLD_MASTER_WALLET) private readonly oldMasterWallet: Wallet,
    @inject(OLD_MASTER_SIGNING_CLIENT) private readonly oldMasterSigningClient: BatchSigningClientService,
    @inject(DERIVED_WALLET_FACTORY) private readonly walletFactory: WalletFactory,
    @inject(OLD_DERIVED_WALLET_FACTORY) private readonly oldWalletFactory: WalletFactory,
    @inject(BATCH_SIGNING_CLIENT_FACTORY) private readonly batchSigningClientServiceFactory: BatchSigningClientServiceFactory,
    private readonly logger: LoggerService
  ) {
    this.logger.setContext(TxManagerService.name);
  }

  async signAndBroadcastWithFundingWallet(messages: readonly EncodeObject[], useOldWallet: boolean = false) {
    const client = useOldWallet ? this.oldMasterSigningClient : this.fundingSigningClient;
    return await client.signAndBroadcast(messages);
  }

  async getFundingWalletAddress(useOldWallet: boolean = false) {
    const wallet = useOldWallet ? this.oldMasterWallet : this.fundingWallet;
    return await wallet.getFirstAddress();
  }

  async signAndBroadcastWithDerivedWallet(
    derivationIndex: number,
    messages: readonly EncodeObject[],
    options?: SignAndBroadcastOptions,
    useOldWallet: boolean = false
  ) {
    const { client, address } = await this.#getClient(derivationIndex, useOldWallet);

    try {
      return await client.signAndBroadcast(messages, options);
    } finally {
      if (!client.hasPendingTransactions && this.#clientsByAddress.has(address)) {
        this.logger.debug({ event: "DEDUPE_SIGNING_CLIENT_CLEAN_UP", address });
        this.#clientsByAddress.delete(address);
      }
    }
  }

  async getDerivedWalletAddress(index: number, useOldWallet: boolean = false) {
    return await this.getDerivedWallet(index, useOldWallet).getFirstAddress();
  }

  async #getClient(derivationIndex: number, useOldWallet: boolean = false): Promise<CachedClient> {
    const wallet = this.getDerivedWallet(derivationIndex, useOldWallet);
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

  getDerivedWallet(index: number, useOldWallet: boolean = false) {
    const factory = useOldWallet ? this.oldWalletFactory : this.walletFactory;
    return factory(index);
  }
}
