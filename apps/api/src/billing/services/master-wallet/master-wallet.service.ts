import { DirectSecp256k1HdWallet, OfflineDirectSigner } from "@cosmjs/proto-signing";
import { SignDoc } from "cosmjs-types/cosmos/tx/v1beta1/tx";

export class MasterWalletService implements OfflineDirectSigner {
  private readonly PREFIX = "akash";

  private readonly instanceAsPromised: Promise<DirectSecp256k1HdWallet>;

  constructor(mnemonic: string) {
    this.instanceAsPromised = DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix: this.PREFIX });
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
