import { describe, expect, it } from "vitest";

import { blockPriceToUakt, blockPriceToUsd } from "./block-price";

describe(blockPriceToUsd.name, () => {
  it("converts uact per block to dollars per hour one to one", () => {
    expect(blockPriceToUsd({ denom: "uact", amountPerBlock: 100 }, null, "hour")).toBe(0.06);
  });

  it("converts uact per block to dollars per month, rounded to cents", () => {
    expect(blockPriceToUsd({ denom: "uact", amountPerBlock: 1000 }, null, "month")).toBe(438.29);
  });

  it("converts uakt per block to dollars at the AKT price", () => {
    expect(blockPriceToUsd({ denom: "uakt", amountPerBlock: 1000 }, 2.5, "hour")).toBe(1.5);
  });

  it("rounds a price under half a cent to zero", () => {
    expect(blockPriceToUsd({ denom: "uact", amountPerBlock: 1 }, null, "hour")).toBe(0);
  });

  it("returns null for uakt without an AKT price", () => {
    expect(blockPriceToUsd({ denom: "uakt", amountPerBlock: 1000 }, 0, "hour")).toBeNull();
    expect(blockPriceToUsd({ denom: "uakt", amountPerBlock: 1000 }, null, "hour")).toBeNull();
  });

  it("returns null for other denoms", () => {
    expect(blockPriceToUsd({ denom: "ibc/12AB", amountPerBlock: 1000 }, 2.5, "hour")).toBeNull();
    expect(blockPriceToUsd({ denom: undefined, amountPerBlock: 1000 }, 2.5, "hour")).toBeNull();
  });
});

describe(blockPriceToUakt.name, () => {
  it("converts uakt per block to uakt per hour", () => {
    expect(blockPriceToUakt({ denom: "uakt", amountPerBlock: 10 }, null, "hour")).toBe(6000);
  });

  it("converts uact per block to uakt per month at the AKT price", () => {
    expect(blockPriceToUakt({ denom: "uact", amountPerBlock: 10 }, 2, "month")).toBe(2191464);
  });

  it("returns null for uact without an AKT price", () => {
    expect(blockPriceToUakt({ denom: "uact", amountPerBlock: 10 }, 0, "hour")).toBeNull();
  });

  it("returns null for other denoms", () => {
    expect(blockPriceToUakt({ denom: "ibc/12AB", amountPerBlock: 10 }, 2, "hour")).toBeNull();
  });
});
