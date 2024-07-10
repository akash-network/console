import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { OfflineDirectSigner } from "@cosmjs/proto-signing/build/signer";
import { SignDoc } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { singleton } from "tsyringe";

import { BillingConfig, InjectBillingConfig } from "@src/billing/providers";

@singleton()
export class MasterWalletService implements OfflineDirectSigner {
  private readonly PREFIX = "akash";

  private readonly instanceAsPromised: Promise<DirectSecp256k1HdWallet>;

  constructor(@InjectBillingConfig() private readonly config: BillingConfig) {
    this.instanceAsPromised = DirectSecp256k1HdWallet.fromMnemonic(this.config.MASTER_WALLET_MNEMONIC, { prefix: this.PREFIX });
  }

  async getAccounts() {
    return (await this.instanceAsPromised).getAccounts();
  }

  async signDirect(signerAddress: string, signDoc: SignDoc) {
    return (await this.instanceAsPromised).signDirect(signerAddress, signDoc);
  }

  async getFirstAddress() {
    const accounts = await this.getAccounts();
    return accounts[0].address;
  }
}
