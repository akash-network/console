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

  it("normalizes digit strings through BigInt, stripping leading zeros", () => {
    expect(asUint64String("007")).toBe("7");
    expect(asUint64String("18446744073709551615")).toBe("18446744073709551615");
  });

  it("rejects strings above the uint64 range", () => {
    expect(asUint64String("18446744073709551616")).toBeNull();
  });

  it("rejects unsafe, negative and fractional numbers", () => {
    expect(asUint64String(2 ** 53)).toBeNull();
    expect(asUint64String(-1)).toBeNull();
    expect(asUint64String(1.5)).toBeNull();
  });

  it("rejects Long objects whose halves are non-integer or outside 32 bits", () => {
    expect(asUint64String({ low: 1.5, high: 0, unsigned: true })).toBeNull();
    expect(asUint64String({ low: 5_000_000_000, high: 0, unsigned: true })).toBeNull();
  });

  it("rejects everything else", () => {
    expect(asUint64String("12.5")).toBeNull();
    expect(asUint64String(null)).toBeNull();
    expect(asUint64String(undefined)).toBeNull();
    expect(asUint64String({})).toBeNull();
  });
});
