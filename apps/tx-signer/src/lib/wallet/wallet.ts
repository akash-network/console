import type { AminoSignResponse, OfflineAminoSigner, StdSignDoc } from "@cosmjs/amino";
import { makeCosmoshubPath, Secp256k1HdWallet } from "@cosmjs/amino";
import type { DirectSignResponse, OfflineDirectSigner } from "@cosmjs/proto-signing";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import type { DirectSecp256k1HdWalletOptions } from "@cosmjs/proto-signing/build/directsecp256k1hdwallet";

export const WALLET_ADDRESS_PREFIX = "akash";

export class Wallet implements OfflineDirectSigner {
  static create(mnemonic?: string, index?: number): Wallet {
    return new Wallet(mnemonic, index);
  }

  readonly #instanceAsPromised: Promise<DirectSecp256k1HdWallet>;
  #aminoSignerPromise?: Promise<OfflineAminoSigner>;
  #walletIndex?: number;

  constructor(mnemonic?: string, index?: number) {
    this.#walletIndex = index;
    if (typeof mnemonic === "undefined") {
      this.#instanceAsPromised = DirectSecp256k1HdWallet.generate(24, this.getInstanceOptions(index));
    } else {
      this.#instanceAsPromised = DirectSecp256k1HdWallet.fromMnemonic(mnemonic, this.getInstanceOptions(index));
    }
  }

  private getInstanceOptions(index?: number): Partial<DirectSecp256k1HdWalletOptions> {
    if (typeof index === "undefined") {
      return { prefix: WALLET_ADDRESS_PREFIX };
    }

    return {
      prefix: WALLET_ADDRESS_PREFIX,
      hdPaths: [makeCosmoshubPath(index)]
    };
  }

  async getAccounts() {
    return (await this.#instanceAsPromised).getAccounts();
  }

  async signDirect(...args: Parameters<DirectSecp256k1HdWallet["signDirect"]>): Promise<DirectSignResponse> {
    return (await this.#instanceAsPromised).signDirect(...args);
  }

  async signAmino(address: string, data: StdSignDoc): Promise<AminoSignResponse> {
    const wallet = await this.#instanceAsPromised;
    this.#aminoSignerPromise ??= Secp256k1HdWallet.fromMnemonic(wallet.mnemonic, this.getInstanceOptions(this.#walletIndex));
    const aminoSigner = await this.#aminoSignerPromise;
    return aminoSigner.signAmino(address, data);
  }

  async getFirstAddress(): Promise<string> {
    const accounts = await this.getAccounts();
    return accounts[0].address;
  }
}
