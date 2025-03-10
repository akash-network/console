import { stringToPath } from "@cosmjs/crypto";
import { DirectSecp256k1HdWallet, OfflineDirectSigner } from "@cosmjs/proto-signing";
import { DirectSecp256k1HdWalletOptions } from "@cosmjs/proto-signing/build/directsecp256k1hdwallet";
import { SignDoc } from "cosmjs-types/cosmos/tx/v1beta1/tx";

export class Wallet implements OfflineDirectSigner {
  private readonly PREFIX = "akash";

  private readonly HD_PATH = "m/44'/118'/0'/0";

  private readonly instanceAsPromised: Promise<DirectSecp256k1HdWallet>;

  constructor(mnemonic?: string, index?: number) {
    if (typeof mnemonic === "undefined") {
      this.instanceAsPromised = DirectSecp256k1HdWallet.generate(24, this.getInstanceOptions(index));
    } else {
      this.instanceAsPromised = DirectSecp256k1HdWallet.fromMnemonic(mnemonic, this.getInstanceOptions(index));
    }
  }

  private getInstanceOptions(index?: number): Partial<DirectSecp256k1HdWalletOptions> {
    if (typeof index === "undefined") {
      return { prefix: this.PREFIX };
    }

    return {
      prefix: this.PREFIX,
      hdPaths: [stringToPath(`${this.HD_PATH}/${index}`)]
    };
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

  async getMnemonic() {
    return (await this.instanceAsPromised).mnemonic;
  }
}
