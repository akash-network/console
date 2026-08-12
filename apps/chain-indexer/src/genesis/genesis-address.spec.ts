import { describe, expect, it } from "vitest";

import { consensusHexAddress, operatorToAccountAddress } from "@src/genesis/genesis-address";

const ED25519_PUBKEY_TYPE = "/cosmos.crypto.ed25519.PubKey";
const SANDBOX_VALIDATOR_PUBKEY = "1YM8H2iPYXxzSEQeFJQipwRnWV4sB2EKgujqdeTYLJs=";

describe("consensusHexAddress", () => {
  it("derives the uppercased hex consensus address from an ed25519 pubkey", () => {
    expect(consensusHexAddress(ED25519_PUBKEY_TYPE, SANDBOX_VALIDATOR_PUBKEY)).toBe("31410FDD5FF7717918AB0D32645E12B6863B2576");
  });

  it("throws for a non-ed25519 pubkey type", () => {
    expect(() => consensusHexAddress("/cosmos.crypto.secp256k1.PubKey", SANDBOX_VALIDATOR_PUBKEY)).toThrow("Unsupported consensus pubkey type");
  });
});

describe("operatorToAccountAddress", () => {
  it("re-encodes a valoper address as its account address over the same bytes", () => {
    expect(operatorToAccountAddress("akashvaloper1dq9wvqemmpvanmwsdttajsn4hmtx5zk7cgw7cz")).toBe("akash1dq9wvqemmpvanmwsdttajsn4hmtx5zk7j2qcgg");
  });
});
