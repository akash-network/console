import { encodeSecp256k1Signature, type StdSignature } from "@cosmjs/amino";
import { Bip39, EnglishMnemonic, Secp256k1, sha256, Slip10, Slip10Curve, stringToPath } from "@cosmjs/crypto";
import type { DirectSecp256k1HdWallet, DirectSecp256k1HdWalletOptions } from "@cosmjs/proto-signing";

export interface SignArbitraryAkashWallet {
  pubkey: Uint8Array;
  address: string;
  signArbitrary: (signer: string, data: string | Uint8Array, accountIndex?: number) => Promise<StdSignature>;
}

const BASE_HD_PATH = "m/44'/118'/0'/0/";

/**
 * Create a custom wallet that can sign arbitrary data
 * @param wallet - The DirectSecp256k1HdWallet instance to use for signing
 * @returns An Akash Wallet interface implementation
 */
export async function createSignArbitraryAkashWallet(wallet: DirectSecp256k1HdWallet, accountIndex: number = 0): Promise<SignArbitraryAkashWallet> {
  const [account] = await wallet.getAccounts();

  return {
    pubkey: account.pubkey,
    address: account.address,
    signArbitrary: async (signer: string, data: string | Uint8Array): Promise<StdSignature> => {
      const message = typeof data === "string" ? new TextEncoder().encode(data) : data;
      const hashedMessage = sha256(message);
      const seed = await fromMnemonic(wallet.mnemonic);
      const { privkey } = Slip10.derivePath(Slip10Curve.Secp256k1, seed, stringToPath(`${BASE_HD_PATH}${accountIndex}`));
      const signature = await Secp256k1.createSignature(hashedMessage, privkey);
      const signatureBytes = new Uint8Array([...signature.r(32), ...signature.s(32)]);
      const stdSignature = encodeSecp256k1Signature(account.pubkey, signatureBytes);

      return {
        ...stdSignature,
        signature: Buffer.from(signatureBytes).toString("base64url")
      };
    }
  };
}

async function fromMnemonic(mnemonic: string, options: Partial<DirectSecp256k1HdWalletOptions> = {}): Promise<Uint8Array> {
  const mnemonicChecked = new EnglishMnemonic(mnemonic);
  const seed = await Bip39.mnemonicToSeed(mnemonicChecked, options.bip39Password);
  return seed;
}
