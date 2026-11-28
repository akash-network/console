import { Secp256k1 } from "@cosmjs/crypto";
import { createCipheriv, createDecipheriv, createPublicKey, randomBytes } from "node:crypto";

import type { KmsClient } from "@src/providers/kms-client.provider";

const COORDINATE_BYTES = 32;
const NONCE_BYTES = 12;
const AUTH_TAG_BYTES = 16;

export type LocalKmsClient = KmsClient & { encrypt(plaintext: string): Uint8Array };

export function createLocalKmsClient(): LocalKmsClient {
  const privateKey = Uint8Array.from(randomBytes(32));
  const encryptionKey = randomBytes(32);

  return {
    encrypt(plaintext) {
      const nonce = randomBytes(NONCE_BYTES);
      const cipher = createCipheriv("aes-256-gcm", encryptionKey, nonce);
      const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);

      return Uint8Array.from(Buffer.concat([nonce, cipher.getAuthTag(), encrypted]));
    },
    async decrypt({ ciphertext }) {
      const sealed = Buffer.from(ciphertext);
      const decipher = createDecipheriv("aes-256-gcm", encryptionKey, sealed.subarray(0, NONCE_BYTES));
      decipher.setAuthTag(sealed.subarray(NONCE_BYTES, NONCE_BYTES + AUTH_TAG_BYTES));

      return [{ plaintext: Buffer.concat([decipher.update(sealed.subarray(NONCE_BYTES + AUTH_TAG_BYTES)), decipher.final()]) }];
    },
    async getPublicKey() {
      const { pubkey } = await Secp256k1.makeKeypair(privateKey);
      const jwk = {
        kty: "EC",
        crv: "secp256k1",
        x: Buffer.from(pubkey.slice(1, 1 + COORDINATE_BYTES)).toString("base64url"),
        y: Buffer.from(pubkey.slice(1 + COORDINATE_BYTES)).toString("base64url")
      };

      return [{ pem: createPublicKey({ key: jwk, format: "jwk" }).export({ type: "spki", format: "pem" }).toString() }];
    },
    async asymmetricSign({ name, digest }) {
      const signature = await Secp256k1.createSignature(digest.sha256, privateKey);

      return [{ name, signature: signature.toDer() }];
    }
  };
}
