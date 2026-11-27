import { Secp256k1 } from "@cosmjs/crypto";
import { createPublicKey, randomBytes } from "node:crypto";

import type { KmsAsymmetricKeyClient } from "@src/lib/kms-wallet/kms-signing-key";

const COORDINATE_BYTES = 32;

export function createLocalKmsClient(): KmsAsymmetricKeyClient {
  const privateKey = Uint8Array.from(randomBytes(32));

  return {
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
