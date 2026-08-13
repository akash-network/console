import { describe, expect, it } from "vitest";

import { diffCoins } from "@src/reconcile/coin-diff";

describe("diffCoins", () => {
  it("returns no differences when both sides match", () => {
    expect(diffCoins([{ denom: "uakt", amount: 100n }], [{ denom: "uakt", amount: 100n }])).toEqual([]);
  });

  it("reports a denom whose amounts differ", () => {
    expect(diffCoins([{ denom: "uakt", amount: 100n }], [{ denom: "uakt", amount: 90n }])).toEqual([{ denom: "uakt", expected: 100n, actual: 90n }]);
  });

  it("reports a denom present only on the chain as a zero ledger balance", () => {
    expect(diffCoins([{ denom: "uakt", amount: 5n }], [])).toEqual([{ denom: "uakt", expected: 5n, actual: 0n }]);
  });

  it("reports a denom present only in the ledger as a zero chain balance", () => {
    expect(diffCoins([], [{ denom: "uakt", amount: 5n }])).toEqual([{ denom: "uakt", expected: 0n, actual: 5n }]);
  });

  it("orders differences by denom", () => {
    expect(
      diffCoins(
        [
          { denom: "uosmo", amount: 1n },
          { denom: "uakt", amount: 1n }
        ],
        []
      ).map(diff => diff.denom)
    ).toEqual(["uakt", "uosmo"]);
  });
});
