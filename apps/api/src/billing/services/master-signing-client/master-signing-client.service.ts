import type { StdFee } from "@cosmjs/amino";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { SigningStargateClient } from "@cosmjs/stargate";
import type { SignerData } from "@cosmjs/stargate/build/signingstargateclient";
import { singleton } from "tsyringe";

import { BillingConfig, InjectBillingConfig } from "@src/billing/providers";
import { MasterWalletService } from "@src/billing/services/master-wallet/master-wallet.service";

@singleton()
export class MasterSigningClientService {
  private readonly clientAsPromised: Promise<SigningStargateClient>;

  constructor(
    @InjectBillingConfig() private readonly config: BillingConfig,
    private readonly masterWalletService: MasterWalletService
  ) {
    this.clientAsPromised = SigningStargateClient.connectWithSigner(this.config.RPC_NODE_ENDPOINT, this.masterWalletService);
  }

  async signAndBroadcast(signerAddress: string, messages: readonly EncodeObject[], fee: StdFee | "auto" | number, memo?: string) {
    return (await this.clientAsPromised).signAndBroadcast(signerAddress, messages, fee, memo);
  }

  async sign(signerAddress: string, messages: readonly EncodeObject[], fee: StdFee, memo: string, explicitSignerData?: SignerData) {
    return (await this.clientAsPromised).sign(signerAddress, messages, fee, memo, explicitSignerData);
  }

  async simulate(signerAddress: string, messages: readonly EncodeObject[], memo: string) {
    return (await this.clientAsPromised).simulate(signerAddress, messages, memo);
  }
}
