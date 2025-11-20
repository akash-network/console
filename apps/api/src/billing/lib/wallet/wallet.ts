import type { AminoSignResponse, OfflineAminoSigner, StdSignDoc } from "@cosmjs/amino";
import { makeCosmoshubPath, Secp256k1HdWallet } from "@cosmjs/amino";
import type { DirectSignResponse, OfflineDirectSigner } from "@cosmjs/proto-signing";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import type { DirectSecp256k1HdWalletOptions } from "@cosmjs/proto-signing/build/directsecp256k1hdwallet";

export class Wallet implements OfflineDirectSigner {
  static create(mnemonic?: string, index?: number): Wallet {
    return new Wallet(mnemonic, index);
  }

  private readonly PREFIX = "akash";

  private readonly instanceAsPromised: Promise<DirectSecp256k1HdWallet>;
  private aminoSignerPromise?: Promise<OfflineAminoSigner>;
  private readonly walletIndex?: number;

  constructor(mnemonic?: string, index?: number) {
    this.walletIndex = index;
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
      hdPaths: [makeCosmoshubPath(index)]
    };
  }

  async getAccounts() {
    return (await this.instanceAsPromised).getAccounts();
  }

  async signDirect(...args: Parameters<DirectSecp256k1HdWallet["signDirect"]>): Promise<DirectSignResponse> {
    return (await this.instanceAsPromised).signDirect(...args);
  }

  async signAmino(address: string, data: StdSignDoc): Promise<AminoSignResponse> {
    const wallet = await this.instanceAsPromised;
    this.aminoSignerPromise ??= Secp256k1HdWallet.fromMnemonic(wallet.mnemonic, this.getInstanceOptions(this.walletIndex));
    const aminoSigner = await this.aminoSignerPromise;
    return aminoSigner.signAmino(address, data);
  }

  async getFirstAddress() {
    const accounts = await this.getAccounts();
    return accounts[0].address;
  }

  async getMnemonic() {
    return (await this.instanceAsPromised).mnemonic;
  }

  async getInstance() {
    return await this.instanceAsPromised;
  }
}
