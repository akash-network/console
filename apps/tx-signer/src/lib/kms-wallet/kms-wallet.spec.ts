import { Secp256k1, Secp256k1Signature, sha256 } from "@cosmjs/crypto";
import { fromBase64 } from "@cosmjs/encoding";
import { DirectSecp256k1Wallet, makeSignBytes, makeSignDoc } from "@cosmjs/proto-signing";
import { createPublicKey, generateKeyPairSync, randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { KmsWallet, type RemoteSigningKey } from "./kms-wallet";

const SECP256K1_ORDER = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;

describe(KmsWallet.name, () => {
  describe("getAccounts", () => {
    it("derives the same address and public key a local wallet derives from the same key", async () => {
      const { wallet, localAccount } = await setup();

      const [account] = await wallet.getAccounts();

      expect(account).toEqual({ address: localAccount.address, algo: "secp256k1", pubkey: localAccount.pubkey });
      await expect(wallet.getFirstAddress()).resolves.toBe(localAccount.address);
    });

    it("asks the key service for the public key once", async () => {
      const { wallet, key } = await setup();

      await wallet.getAccounts();
      await wallet.getFirstAddress();
      await wallet.signDirect(await wallet.getFirstAddress(), signDoc());

      expect(key.getPublicKeyPem).toHaveBeenCalledTimes(1);
    });

    it("refuses a key on another curve", async () => {
      const { publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
      const wallet = new KmsWallet({
        getPublicKeyPem: vi.fn(async () => publicKey.export({ type: "spki", format: "pem" }).toString()),
        signSha256Digest: vi.fn()
      });

      await expect(wallet.getAccounts()).rejects.toThrow("Expected a secp256k1 public key, got P-256");
    });
  });

  describe("signDirect", () => {
    it("returns a signature over the sign doc that verifies against the wallet's public key", async () => {
      const { wallet, key, localAccount } = await setup();
      const doc = signDoc();

      const { signed, signature } = await wallet.signDirect(localAccount.address, doc);

      const digest = sha256(makeSignBytes(doc));
      expect(signed).toBe(doc);
      expect(key.signSha256Digest).toHaveBeenCalledWith(digest);
      expect(fromBase64(signature.pub_key.value)).toEqual(localAccount.pubkey);
      expect(await Secp256k1.verifySignature(Secp256k1Signature.fromFixedLength(fromBase64(signature.signature)), digest, localAccount.pubkey)).toBe(true);
    });

    it("returns the lower s when the key service answers with the upper one", async () => {
      const { wallet, localAccount } = await setup({ answersWithHighS: true });
      const doc = signDoc();

      const { signature } = await wallet.signDirect(localAccount.address, doc);

      const fixed = Secp256k1Signature.fromFixedLength(fromBase64(signature.signature));
      expect(scalarOf(fixed.s(32)) <= SECP256K1_ORDER / 2n).toBe(true);
      expect(await Secp256k1.verifySignature(fixed, sha256(makeSignBytes(doc)), localAccount.pubkey)).toBe(true);
    });

    it.each([
      { scalar: "s", accountNumber: 258, read: (signature: Secp256k1Signature) => signature.s() },
      { scalar: "r", accountNumber: 436, read: (signature: Secp256k1Signature) => signature.r() }
    ])("returns a valid lower-s signature whose $scalar starts with a zero byte", async ({ accountNumber, read }) => {
      const { wallet, localAccount } = await setup({ answersWithHighS: true, privateKey: Uint8Array.from({ length: 32 }, () => 0x11) });
      const doc = makeSignDoc(Uint8Array.from([1, 2, 3]), Uint8Array.from([4, 5, 6]), "akashnet-2", accountNumber);

      const { signature } = await wallet.signDirect(localAccount.address, doc);

      const fixed = Secp256k1Signature.fromFixedLength(fromBase64(signature.signature));
      expect(read(fixed)).toHaveLength(31);
      expect(scalarOf(fixed.s(32)) <= SECP256K1_ORDER / 2n).toBe(true);
      expect(await Secp256k1.verifySignature(fixed, sha256(makeSignBytes(doc)), localAccount.pubkey)).toBe(true);
    });

    it("returns the signature as the key service gave it when its s is already the lower one", async () => {
      const { wallet, key, localAccount } = await setup();

      const { signature } = await wallet.signDirect(localAccount.address, signDoc());

      const fromKeyService = Secp256k1Signature.fromDer(await key.signSha256Digest.mock.results[0].value);
      expect(fromBase64(signature.signature)).toEqual(fromKeyService.toFixedLength());
    });

    it("refuses to sign for an address that is not the wallet's", async () => {
      const { wallet, key } = await setup();
      const other = await setup();

      await expect(wallet.signDirect(other.localAccount.address, signDoc())).rejects.toThrow(`Address ${other.localAccount.address} not found in wallet`);

      expect(key.signSha256Digest).not.toHaveBeenCalled();
    });

    it("refuses a signature that another key produced", async () => {
      const other = await setup();
      const { wallet, localAccount } = await setup({ signsWith: other.privateKey });

      await expect(wallet.signDirect(localAccount.address, signDoc())).rejects.toThrow("does not verify against this wallet's public key");
    });
  });

  function signDoc() {
    return makeSignDoc(randomBytes(64), randomBytes(48), "akashnet-2", 17);
  }

  function scalarOf(bytes: Uint8Array) {
    return BigInt(`0x${Buffer.from(bytes).toString("hex")}`);
  }

  function scalarBytes(value: bigint) {
    return Uint8Array.from(Buffer.from(value.toString(16).padStart(64, "0"), "hex"));
  }

  function pemOf(uncompressedPubkey: Uint8Array) {
    const jwk = {
      kty: "EC",
      crv: "secp256k1",
      x: Buffer.from(uncompressedPubkey.slice(1, 33)).toString("base64url"),
      y: Buffer.from(uncompressedPubkey.slice(33)).toString("base64url")
    };

    return createPublicKey({ key: jwk, format: "jwk" }).export({ type: "spki", format: "pem" }).toString();
  }

  async function setup(input: { answersWithHighS?: boolean; signsWith?: Uint8Array; privateKey?: Uint8Array } = {}) {
    const privateKey = input.privateKey ?? Uint8Array.from(randomBytes(32));
    const keypair = await Secp256k1.makeKeypair(privateKey);
    const [localAccount] = await (await DirectSecp256k1Wallet.fromKey(privateKey, "akash")).getAccounts();
    const key = {
      getPublicKeyPem: vi.fn(async () => pemOf(keypair.pubkey)),
      signSha256Digest: vi.fn(async (digest: Uint8Array) => {
        const signature = await Secp256k1.createSignature(digest, input.signsWith ?? privateKey);
        const lowS = scalarOf(signature.s(32));
        const s = input.answersWithHighS ? SECP256K1_ORDER - lowS : lowS;

        return Secp256k1Signature.fromFixedLength(Uint8Array.from([...signature.r(32), ...scalarBytes(s)])).toDer();
      })
    } satisfies RemoteSigningKey;

    return { wallet: new KmsWallet(key), key, privateKey, localAccount };
  }
});
