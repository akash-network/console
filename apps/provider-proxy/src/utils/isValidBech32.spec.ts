import { toBech32 } from "@cosmjs/encoding";
import { describe, expect, it } from "vitest";

import { isValidBech32Address } from "./isValidBech32";

describe(isValidBech32Address.name, () => {
  it.each([
    ["an account address", 20],
    ["a module address", 32]
  ])("accepts %s payload", (_label, byteLength) => {
    expect(isValidBech32Address(toBech32("akash", new Uint8Array(byteLength).fill(7)))).toBe(true);
  });

  it.each([19, 21, 31, 33])("rejects a %i-byte payload", byteLength => {
    expect(isValidBech32Address(toBech32("akash", new Uint8Array(byteLength).fill(7)))).toBe(false);
  });

  it("rejects a payload padded to thousands of characters", () => {
    expect(isValidBech32Address(toBech32("akash", new Uint8Array(4000), Infinity))).toBe(false);
  });

  it("accepts any prefix when none is required", () => {
    expect(isValidBech32Address(toBech32("cosmos", new Uint8Array(20).fill(7)))).toBe(true);
  });

  it("accepts an address whose prefix matches the required one", () => {
    expect(isValidBech32Address(toBech32("akash", new Uint8Array(20).fill(7)), "akash")).toBe(true);
  });

  it("rejects an address whose prefix differs from the required one", () => {
    expect(isValidBech32Address(toBech32("cosmos", new Uint8Array(20).fill(7)), "akash")).toBe(false);
  });

  it("rejects a string that is not bech32", () => {
    expect(isValidBech32Address("akash1notanaddress")).toBe(false);
  });
});
