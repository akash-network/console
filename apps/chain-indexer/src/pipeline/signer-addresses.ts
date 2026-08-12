import type { Pubkey, SinglePubkey } from "@cosmjs/amino";
import { isMultisigThresholdPubkey, isSinglePubkey, pubkeyToAddress } from "@cosmjs/amino";
import { decodePubkey } from "@cosmjs/proto-signing";
import type { SignerInfo } from "cosmjs-types/cosmos/tx/v1beta1/tx";

import { AKASH_ADDRESS_PREFIX } from "@src/genesis/genesis-address";

function flattenSinglePubkeys(pubkey: Pubkey): SinglePubkey[] {
  if (isMultisigThresholdPubkey(pubkey)) {
    return pubkey.value.pubkeys.flatMap(flattenSinglePubkeys);
  }

  return isSinglePubkey(pubkey) ? [pubkey] : [];
}

/**
 * Bech32 account addresses of every signer of a transaction. A multisig signer expands to one address per
 * member key, mirroring the legacy indexer. An undecodable pubkey (e.g. a legacy amino multisig) yields no
 * address for that signer rather than failing the whole block.
 */
export function deriveSignerAddresses(signerInfos: readonly SignerInfo[]): string[] {
  const addresses: string[] = [];

  for (const signerInfo of signerInfos) {
    if (!signerInfo.publicKey) {
      continue;
    }

    try {
      const pubkey = decodePubkey(signerInfo.publicKey);
      if (!pubkey) {
        continue;
      }

      for (const single of flattenSinglePubkeys(pubkey)) {
        addresses.push(pubkeyToAddress(single, AKASH_ADDRESS_PREFIX));
      }
    } catch {
      continue;
    }
  }

  return addresses;
}
