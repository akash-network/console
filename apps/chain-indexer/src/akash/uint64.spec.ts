import { describe, expect, it } from "vitest";

import { asUint64String } from "@src/akash/uint64";

describe("asUint64String", () => {
  it("passes through digit strings from the chain SDK codegen", () => {
    expect(asUint64String("12345")).toBe("12345");
  });

  it("accepts plain numbers", () => {
    expect(asUint64String(12345)).toBe("12345");
  });

  it("recombines legacy protobufjs Long objects", () => {
    expect(asUint64String({ low: 12345, high: 0, unsigned: true })).toBe("12345");
    expect(asUint64String({ low: -1, high: 0, unsigned: true })).toBe("4294967295");
    expect(asUint64String({ low: 0, high: 1, unsigned: true })).toBe("4294967296");
  });

  it("rejects everything else", () => {
    expect(asUint64String("12.5")).toBeNull();
    expect(asUint64String(null)).toBeNull();
    expect(asUint64String(undefined)).toBeNull();
    expect(asUint64String({})).toBeNull();
  });
});
