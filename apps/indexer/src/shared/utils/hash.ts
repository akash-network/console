import { createHash } from "node:crypto";

/** Derives the uppercase hex transaction hash from a base64-encoded transaction, matching the Tendermint tx hash format. */
export function getTransactionHash(txBase64: string): string {
  return createHash("sha256").update(Buffer.from(txBase64, "base64")).digest("hex").toUpperCase();
}
