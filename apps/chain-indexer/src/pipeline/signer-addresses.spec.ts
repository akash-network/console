import { createMultisigThresholdPubkey, encodeSecp256k1Pubkey, pubkeyToAddress } from "@cosmjs/amino";
import { encodePubkey } from "@cosmjs/proto-signing";
import { SignerInfo } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { describe, expect, it } from "vitest";

import { AKASH_ADDRESS_PREFIX } from "@src/genesis/genesis-address";
import { deriveSignerAddresses } from "@src/pipeline/signer-addresses";

function secp256k1Pubkey(firstByte: number) {
  return encodeSecp256k1Pubkey(new Uint8Array([firstByte, ...new Array<number>(32).fill(1)]));
}

function signerInfoWith(pubkey: Parameters<typeof encodePubkey>[0]) {
  return SignerInfo.fromPartial({ publicKey: encodePubkey(pubkey) });
}

describe("deriveSignerAddresses", () => {
  it("derives the account address of a single secp256k1 signer", () => {
    const pubkey = secp256k1Pubkey(2);

    expect(deriveSignerAddresses([signerInfoWith(pubkey)])).toEqual([pubkeyToAddress(pubkey, AKASH_ADDRESS_PREFIX)]);
  });

  it("derives every member address of a multisig signer", () => {
    const first = secp256k1Pubkey(2);
    const second = secp256k1Pubkey(3);
    const multisig = createMultisigThresholdPubkey([first, second], 1);

    expect(deriveSignerAddresses([signerInfoWith(multisig)])).toEqual([
      pubkeyToAddress(first, AKASH_ADDRESS_PREFIX),
      pubkeyToAddress(second, AKASH_ADDRESS_PREFIX)
    ]);
  });

  it("skips signer infos without a public key", () => {
    expect(deriveSignerAddresses([SignerInfo.fromPartial({})])).toEqual([]);
  });
});
