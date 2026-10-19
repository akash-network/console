import { DirectSecp256k1HdWallet, Registry } from "@cosmjs/proto-signing";
import { SigningStargateClient } from "@cosmjs/stargate";
import { singleton } from "tsyringe";

import { InjectTypeRegistry } from "@src/billing/providers/type-registry.provider";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";

@singleton()
export class GpuBotSigningClientFactory {
  constructor(
    private readonly config: BillingConfigService,
    @InjectTypeRegistry() private readonly typeRegistry: Registry
  ) {}

  async connect(mnemonic: string): Promise<{ address: string; client: SigningStargateClient }> {
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix: "akash" });
    const [account] = await wallet.getAccounts();
    const client = await SigningStargateClient.connectWithSigner(this.config.get("RPC_NODE_ENDPOINT"), wallet, {
      registry: this.typeRegistry,
      broadcastTimeoutMs: 30_000
    });

    return { address: account.address, client };
  }
}
