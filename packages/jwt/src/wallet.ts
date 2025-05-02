import { ec as EC } from "elliptic";

import type { JWK } from "./types";

const ec = new EC("secp256k1");

/**
 * Utility functions for working with Cosmos SDK wallets
 */
export class WalletUtils {
  /**
   * Converts a raw public key to JWK format
   * @param pubKey - The raw public key as Uint8Array
   * @returns The public key in JWK format
   */
  static publicKeyToJWK(pubKey: Uint8Array): JWK {
    // Convert pubKey to hex string
    const pubKeyHex = Buffer.from(pubKey).toString("hex");
    const keyPair = ec.keyFromPublic(pubKeyHex, "hex");
    const pub = keyPair.getPublic();

    return {
      kty: "EC",
      crv: "secp256k1",
      x: Buffer.from(pub.getX().toArray()).toString("base64url"),
      y: Buffer.from(pub.getY().toArray()).toString("base64url")
    };
  }

  /**
   * Converts a signature to base64url format
   * @param signature - The raw signature as Uint8Array
   * @returns The signature in base64url format
   */
  static signatureToBase64url(signature: Uint8Array): string {
    return Buffer.from(signature).toString("base64url");
  }
}
