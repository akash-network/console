import { LoggerService } from "@akashnetwork/logging";
import { EncodeObject, Registry } from "@cosmjs/proto-signing";
import * as crypto from "crypto";
import { singleton } from "tsyringe";

import { BatchSigningClientService, ExecuteTxOptions } from "@src/billing/lib/batch-signing-client/batch-signing-client.service";
import { Wallet } from "@src/billing/lib/wallet/wallet";
import { InjectTypeRegistry } from "@src/billing/providers/type-registry.provider";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";

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
    @InjectTypeRegistry() private readonly registry: Registry
  ) {}

  async executeManagedTx(mnemonic: string, walletIndex: number, messages: readonly EncodeObject[], options?: ExecuteTxOptions) {
    const { client, key } = this.getClient(mnemonic, walletIndex);

    try {
      return client.executeTx(messages, options);
    } finally {
      if (!client.hasPendingTransactions && this.clientsByAddress.has(key)) {
        this.logger.debug({ event: "DEDUPE_SIGNING_CLIENT_CLEAN_UP", key });
        this.clientsByAddress.delete(key);
      }
    }
  }

  private getClient(mnemonic: string, addressIndex?: number): CachedClient {
    const key = `${crypto.createHash("sha256").update(mnemonic).digest("hex")}/${addressIndex ?? 0}`;

    if (!this.clientsByAddress.has(key)) {
      this.logger.debug({ event: "DEDUPE_SIGNING_CLIENT_CREATE", key });
      this.clientsByAddress.set(key, {
        key: key,
        client: new BatchSigningClientService(this.config, new Wallet(mnemonic, addressIndex), this.registry)
      });
    }

    return this.clientsByAddress.get(key);
  }
}
