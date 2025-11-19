import { EncodeObject, Registry } from "@cosmjs/proto-signing";
import { inject, singleton } from "tsyringe";

import { BatchSigningClientService, SignAndBroadcastOptions } from "@src/billing/lib/batch-signing-client/batch-signing-client.service";
import { createSigningStargateClient } from "@src/billing/lib/signing-stargate-client-factory/signing-stargate-client.factory";
import { Wallet, WalletFactory } from "@src/billing/lib/wallet/wallet";
import { FUNDING_SIGNING_CLIENT } from "@src/billing/providers/signing-client.provider";
import { TYPE_REGISTRY } from "@src/billing/providers/type-registry.provider";
import { FUNDING_WALLET, WALLET_FACTORY } from "@src/billing/providers/wallet.provider";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { LoggerService } from "@src/core";

type CachedClient = {
  address: string;
  client: BatchSigningClientService;
};

@singleton()
export class TxManagerService {
  readonly #clientsByAddress: Map<string, CachedClient> = new Map();

  constructor(
    @inject(FUNDING_WALLET) private readonly fundingWallet: Wallet,
    @inject(FUNDING_SIGNING_CLIENT) private readonly fundingSigningClient: BatchSigningClientService,
    @inject(WALLET_FACTORY) private readonly walletFactory: WalletFactory,
    @inject(TYPE_REGISTRY) private readonly typeRegistry: Registry,
    private readonly billingConfigService: BillingConfigService,
    private readonly logger: LoggerService
  ) {
    this.logger.setContext(TxManagerService.name);
  }

  async signAndBroadcastWithFundingWallet(messages: readonly EncodeObject[]) {
    return await this.fundingSigningClient.signAndBroadcast(messages);
  }

  async getFundingWalletAddress() {
    return await this.fundingWallet.getFirstAddress();
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

  async getDerivedWalletAddress(index: number) {
    return await this.getDerivedWallet(index).getFirstAddress();
  }

  async #getClient(derivationIndex: number): Promise<CachedClient> {
    const wallet = this.getDerivedWallet(derivationIndex);
    const address = await wallet.getFirstAddress();

    if (!this.#clientsByAddress.has(address)) {
      this.logger.debug({ event: "DERIVED_SIGNING_CLIENT_CREATE", address });
      this.#clientsByAddress.set(address, {
        address,
        client: new BatchSigningClientService(this.billingConfigService, wallet, this.typeRegistry, createSigningStargateClient)
      });
    }

    return this.#clientsByAddress.get(address)!;
  }

  getDerivedWallet(index: number) {
    const mnemonic = this.billingConfigService.get("DERIVATION_WALLET_MNEMONIC");
    if (!mnemonic) {
      throw new Error(`DERIVATION_WALLET_MNEMONIC is empty, failed to derive a wallet for index ${index}`);
    }

    return this.walletFactory(mnemonic, index);
  }
}
