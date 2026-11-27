import { encodeSecp256k1Signature, rawSecp256k1PubkeyToRawAddress } from "@cosmjs/amino";
import { Secp256k1, Secp256k1Signature, sha256 } from "@cosmjs/crypto";
import { toBech32 } from "@cosmjs/encoding";
import type { AccountData, DirectSignResponse, OfflineDirectSigner } from "@cosmjs/proto-signing";
import { makeSignBytes } from "@cosmjs/proto-signing";
import { createPublicKey } from "node:crypto";

import { WALLET_ADDRESS_PREFIX } from "@src/lib/wallet/wallet";
import { memoizeAsync } from "../../caching/helpers/helpers";

/** A secp256k1 key that never leaves the service holding it: it hands out its public key and signs SHA-256 digests. */
export interface RemoteSigningKey {
  getPublicKeyPem(): Promise<string>;
  /** Resolves to a DER-encoded ECDSA signature. */
  signSha256Digest(digest: Uint8Array): Promise<Uint8Array>;
}

const SECP256K1_ORDER = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const SCALAR_BYTES = 32;

/** Signs Akash transactions with a key held by a remote key service, so no seed phrase exists for this wallet. */
export class KmsWallet implements OfflineDirectSigner {
  readonly #getAccount = memoizeAsync(async (): Promise<AccountData> => {
    const pubkey = compressedPubkeyOf(await this.key.getPublicKeyPem());

    return { address: toBech32(WALLET_ADDRESS_PREFIX, rawSecp256k1PubkeyToRawAddress(pubkey)), algo: "secp256k1", pubkey };
  });

  constructor(private readonly key: RemoteSigningKey) {}

  async getAccounts(): Promise<readonly AccountData[]> {
    return [await this.#getAccount()];
  }

  async getFirstAddress(): Promise<string> {
    return (await this.#getAccount()).address;
  }

  async signDirect(signerAddress: string, signDoc: Parameters<OfflineDirectSigner["signDirect"]>[1]): Promise<DirectSignResponse> {
    const account = await this.#getAccount();

    if (signerAddress !== account.address) {
      throw new Error(`Address ${signerAddress} not found in wallet`);
    }

    const digest = sha256(makeSignBytes(signDoc));
    const signature = withLowS(Secp256k1Signature.fromDer(await this.key.signSha256Digest(digest)));

    if (!(await Secp256k1.verifySignature(signature, digest, account.pubkey))) {
      throw new Error("The key service returned a signature that does not verify against this wallet's public key");
    }

    return { signed: signDoc, signature: encodeSecp256k1Signature(account.pubkey, signature.toFixedLength()) };
  }
}

function compressedPubkeyOf(pem: string): Uint8Array {
  const { crv, x, y } = createPublicKey(pem).export({ format: "jwk" });

  if (crv !== "secp256k1" || !x || !y) {
    throw new Error(`Expected a secp256k1 public key, got ${crv ?? "a key without a curve"}`);
  }

  return Secp256k1.compressPubkey(Uint8Array.from([0x04, ...Buffer.from(x, "base64url"), ...Buffer.from(y, "base64url")]));
}

/** The chain rejects the upper of the two valid `s` values, and a key service is free to return either. */
function withLowS(signature: Secp256k1Signature): Secp256k1Signature {
  const s = BigInt(`0x${Buffer.from(signature.s(SCALAR_BYTES)).toString("hex")}`);

  if (s <= SECP256K1_ORDER / 2n) return signature;

  const lowS = Buffer.from((SECP256K1_ORDER - s).toString(16).padStart(SCALAR_BYTES * 2, "0"), "hex");

  return Secp256k1Signature.fromFixedLength(Uint8Array.from([...signature.r(SCALAR_BYTES), ...lowS]));
}
