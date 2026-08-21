import { fromBase64, fromBech32, toBech32, toHex } from "@cosmjs/encoding";
import { createHash } from "node:crypto";

/** Bech32 human-readable prefix for account addresses. Shared by mainnet, sandbox and testnet — all Akash chains. */
export const AKASH_ADDRESS_PREFIX = "akash";

const ED25519_PUBKEY_TYPE = "/cosmos.crypto.ed25519.PubKey";

/**
 * Consensus (hex) address of a validator: the first 20 bytes of SHA-256 over the ed25519 pubkey,
 * uppercased, matching CometBFT and the legacy indexer. Consensus keys are always ed25519, so an
 * unexpected type is a hard error rather than a silently wrong address.
 */
export function consensusHexAddress(pubkeyType: string, pubkeyBase64: string): string {
  if (pubkeyType !== ED25519_PUBKEY_TYPE) {
    throw new Error(`Unsupported consensus pubkey type ${pubkeyType}`);
  }

  const digest = createHash("sha256").update(fromBase64(pubkeyBase64)).digest();
  return toHex(digest.subarray(0, 20)).toUpperCase();
}

/** Re-encodes an operator (`akashvaloper…`) address as its account (`akash…`) address; the underlying bytes are identical. */
export function operatorToAccountAddress(operatorAddress: string): string {
  const { prefix, data } = fromBech32(operatorAddress);
  return toBech32(prefix.replace(/valoper$/, ""), data);
}
