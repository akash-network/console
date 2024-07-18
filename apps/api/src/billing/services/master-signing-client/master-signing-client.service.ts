import type { StdFee } from "@cosmjs/amino";
import { EncodeObject, Registry } from "@cosmjs/proto-signing";
import { SigningStargateClient } from "@cosmjs/stargate";
import type { SignerData } from "@cosmjs/stargate/build/signingstargateclient";
import { singleton } from "tsyringe";

import { BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { InjectTypeRegistry } from "@src/billing/providers/type-registry.provider";
import { MasterWalletService } from "@src/billing/services/master-wallet/master-wallet.service";

@singleton()
export class MasterSigningClientService {
  private readonly clientAsPromised: Promise<SigningStargateClient>;

  constructor(
    @InjectBillingConfig() private readonly config: BillingConfig,
    private readonly masterWalletService: MasterWalletService,
    @InjectTypeRegistry() private readonly registry: Registry
  ) {
    this.clientAsPromised = SigningStargateClient.connectWithSigner(this.config.RPC_NODE_ENDPOINT, this.masterWalletService, {
      registry
    });
  }

  async signAndBroadcast(messages: readonly EncodeObject[], fee: StdFee | "auto" | number, memo?: string) {
    return (await this.clientAsPromised).signAndBroadcast(await this.masterWalletService.getFirstAddress(), messages, fee, memo);
  }

  async sign(messages: readonly EncodeObject[], fee: StdFee, memo: string, explicitSignerData?: SignerData) {
    return (await this.clientAsPromised).sign(await this.masterWalletService.getFirstAddress(), messages, fee, memo, explicitSignerData);
  }

  async simulate(messages: readonly EncodeObject[], memo: string) {
    return (await this.clientAsPromised).simulate(await this.masterWalletService.getFirstAddress(), messages, memo);
  }
}
