import base64url from "base64url";
import * as elliptic from "elliptic";

import type { JWK } from "./types.js";

/**
 * Utility functions for working with Cosmos SDK wallets
 */
export class WalletUtils {
  /**
   * Converts a public key to JWK format
   * @param pubKey - The public key to convert
   * @returns The public key in JWK format
   */
  static publicKeyToJWK(pubKey: Uint8Array): JWK {
    const ec = new elliptic.ec("secp256k1");
    const publicKey = ec.keyFromPublic(Buffer.from(pubKey));
    const publicKeyPoint = publicKey.getPublic();
    const x = publicKeyPoint.getX();
    const y = publicKeyPoint.getY();

    const xHex = x.toString("hex");
    const yHex = y.toString("hex");
    const xBase64url = base64url(Buffer.from(xHex, "hex"));
    const yBase64url = base64url(Buffer.from(yHex, "hex"));

    return {
      kty: "EC",
      crv: "secp256k1",
      x: xBase64url,
      y: yBase64url
    };
  }

  /**
   * Converts a signature to base64url format
   * @param signature - The signature to convert
   * @returns The signature in base64url format
   */
  static signatureToBase64url(signature: Uint8Array): string {
    return base64url(Buffer.from(signature));
  }
}
