import { toBech32 } from "@cosmjs/encoding";
import { describe, expect, it } from "vitest";

import { isValidBech32Address } from "./addresses";

describe(isValidBech32Address.name, () => {
  it.each([
    ["an account address", 20],
    ["a module address", 32]
  ])("accepts %s", (_label, byteLength) => {
    expect(isValidBech32Address(toBech32("akash", new Uint8Array(byteLength).fill(7)))).toBe(true);
  });

  it.each([
    ["shorter than an account address", 19],
    ["between account and module address lengths", 21],
    ["just under a module address", 31],
    ["longer than a module address", 33]
  ])("rejects a payload %s", (_label, byteLength) => {
    expect(isValidBech32Address(toBech32("akash", new Uint8Array(byteLength)))).toBe(false);
  });

  it("rejects a payload padded to thousands of characters", () => {
    expect(isValidBech32Address(toBech32("akash", new Uint8Array(4000), Infinity))).toBe(false);
  });

  it("accepts an address with the expected prefix", () => {
    expect(isValidBech32Address(toBech32("akashvaloper", new Uint8Array(20)), "akashvaloper")).toBe(true);
  });

  it("rejects an address with another prefix", () => {
    expect(isValidBech32Address(toBech32("cosmos", new Uint8Array(20)), "akash")).toBe(false);
  });

  it("accepts any prefix when none is expected", () => {
    expect(isValidBech32Address(toBech32("cosmos", new Uint8Array(20)))).toBe(true);
  });

  it("rejects a string that is not bech32", () => {
    expect(isValidBech32Address("akash1notanaddress")).toBe(false);
  });
});
