import { LoggerService } from "@akashnetwork/logging";
import { EncodeObject, Registry } from "@cosmjs/proto-signing";
import * as crypto from "crypto";
import { singleton } from "tsyringe";

import { BatchSigningClientService, SignAndBroadcastOptions } from "@src/billing/lib/batch-signing-client/batch-signing-client.service";
import { SyncSigningStargateClient } from "@src/billing/lib/sync-signing-stargate-client/sync-signing-stargate-client";
import { Wallet } from "@src/billing/lib/wallet/wallet";
import { InjectTypeRegistry } from "@src/billing/providers/type-registry.provider";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { ChainErrorService } from "../chain-error/chain-error.service";

type CachedClient = {
  key: string;
  client: BatchSigningClientService;
};

@singleton()
export class DedupeSigningClientService {
  private readonly clientsByAddress: Map<string, CachedClient> = new Map();

  private readonly logger = LoggerService.forContext(DedupeSigningClientService.name);

  constructor(
    private readonly config: BillingConfigService,
    @InjectTypeRegistry() private readonly registry: Registry,
    private readonly chainErrorService: ChainErrorService
  ) {}

  async executeManagedTx(mnemonic: string, walletIndex: number, messages: readonly EncodeObject[], options?: SignAndBroadcastOptions) {
    const { client, key } = this.getClient(mnemonic, walletIndex);

    try {
      return client.signAndBroadcast(messages, options);
    } finally {
      if (!client.hasPendingTransactions && this.clientsByAddress.has(key)) {
        this.logger.debug({ event: "DEDUPE_SIGNING_CLIENT_CLEAN_UP", key });
        this.clientsByAddress.delete(key);
        client.dispose();
      }
    }
  }

  private getClient(mnemonic: string, addressIndex?: number): CachedClient {
    const key = `${crypto.createHash("sha256").update(mnemonic).digest("hex")}/${addressIndex ?? 0}`;

    if (!this.clientsByAddress.has(key)) {
      this.logger.debug({ event: "DEDUPE_SIGNING_CLIENT_CREATE", key });
      this.clientsByAddress.set(key, {
        key: key,
        client: new BatchSigningClientService(
          this.config,
          new Wallet(mnemonic, addressIndex),
          this.registry,
          SyncSigningStargateClient.init.bind(SyncSigningStargateClient),
          this.chainErrorService
        )
      });
    }

    return this.clientsByAddress.get(key)!;
  }
}
