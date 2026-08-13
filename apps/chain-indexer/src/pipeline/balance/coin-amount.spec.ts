import { describe, expect, it } from "vitest";

import { parseCoins } from "@src/pipeline/balance/coin-amount";

describe("parseCoins", () => {
  it("parses a single coin", () => {
    expect(parseCoins("100uakt")).toEqual([{ denom: "uakt", amount: 100n }]);
  });

  it("parses multiple comma-separated coins preserving order", () => {
    expect(parseCoins("100uakt,5uatom")).toEqual([
      { denom: "uakt", amount: 100n },
      { denom: "uatom", amount: 5n }
    ]);
  });

  it("parses ibc and factory denoms that contain slashes", () => {
    expect(parseCoins("7ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2")).toEqual([
      { denom: "ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2", amount: 7n }
    ]);
  });

  it("returns an empty array for an empty or whitespace value", () => {
    expect(parseCoins("")).toEqual([]);
    expect(parseCoins("   ")).toEqual([]);
  });

  it("skips segments that are not a leading integer followed by a denom", () => {
    expect(parseCoins("100uakt,,garbage")).toEqual([{ denom: "uakt", amount: 100n }]);
  });

  it("parses amounts far beyond Number.MAX_SAFE_INTEGER without precision loss", () => {
    expect(parseCoins("340282366920938463463374607431768211455uakt")).toEqual([{ denom: "uakt", amount: 340282366920938463463374607431768211455n }]);
  });
});
