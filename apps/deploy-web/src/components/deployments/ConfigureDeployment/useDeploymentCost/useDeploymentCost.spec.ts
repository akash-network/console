import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { DEPENDENCIES } from "./useDeploymentCost";
import { useDeploymentCost } from "./useDeploymentCost";

import { renderHook } from "@testing-library/react";

type BidEntry = NonNullable<ReturnType<typeof DEPENDENCIES.useListBids>["data"]>["data"][number];

/** A `listBids` entry; `amount` of "1000000" is 1.0 per block at PRICE_DISPLAY_PRECISION. */
function bidEntry(input: { provider: string; gseq: number; oseq: number; amount: string; denom?: string; state?: string }): BidEntry {
  return mock<BidEntry>({
    bid: {
      id: { provider: input.provider, dseq: "55", gseq: input.gseq, oseq: input.oseq },
      price: { amount: input.amount, denom: input.denom ?? "uakt" },
      state: input.state ?? "open"
    }
  });
}

describe("useDeploymentCost", () => {
  it("returns null before any open bid exists", () => {
    const { result } = setup({ placements: [{ id: "p1", name: "placement-1" }], bids: [] });
    expect(result.current).toBeNull();
  });

  it("returns null when the only bids are not open", () => {
    const { result } = setup({
      placements: [{ id: "p1", name: "placement-1" }],
      bids: [bidEntry({ provider: "a", gseq: 1, oseq: 1, amount: "1000000", state: "closed" })]
    });
    expect(result.current).toBeNull();
  });

  it("ranges over an unselected placement's open bids (cheapest..priciest)", () => {
    const { result } = setup({
      placements: [{ id: "p1", name: "placement-1" }],
      bids: [
        bidEntry({ provider: "a", gseq: 1, oseq: 1, amount: "1000000" }),
        bidEntry({ provider: "b", gseq: 1, oseq: 1, amount: "3000000" })
      ]
    });
    expect(result.current).toEqual({ minPerBlock: 1, maxPerBlock: 3, denom: "uakt" });
  });

  it("ignores non-open bids when computing the range", () => {
    const { result } = setup({
      placements: [{ id: "p1", name: "placement-1" }],
      bids: [
        bidEntry({ provider: "a", gseq: 1, oseq: 1, amount: "2000000" }),
        bidEntry({ provider: "b", gseq: 1, oseq: 1, amount: "9000000", state: "closed" })
      ]
    });
    expect(result.current).toEqual({ minPerBlock: 2, maxPerBlock: 2, denom: "uakt" });
  });

  it("fixes a placement's contribution to its selected bid, ignoring other bids", () => {
    const { result } = setup({
      placements: [{ id: "p1", name: "placement-1" }],
      selections: { p1: "b/55/1/1" },
      bids: [
        bidEntry({ provider: "a", gseq: 1, oseq: 1, amount: "1000000" }),
        bidEntry({ provider: "b", gseq: 1, oseq: 1, amount: "3000000" })
      ]
    });
    expect(result.current).toEqual({ minPerBlock: 3, maxPerBlock: 3, denom: "uakt" });
  });

  it("falls back to the open range when the selected bid is no longer open", () => {
    const { result } = setup({
      placements: [{ id: "p1", name: "placement-1" }],
      selections: { p1: "b/55/1/1" },
      bids: [
        bidEntry({ provider: "a", gseq: 1, oseq: 1, amount: "2000000" }),
        bidEntry({ provider: "b", gseq: 1, oseq: 1, amount: "5000000", state: "closed" })
      ]
    });
    expect(result.current).toEqual({ minPerBlock: 2, maxPerBlock: 2, denom: "uakt" });
  });

  it("sums a fixed selected placement with an unselected ranged placement", () => {
    const { result } = setup({
      placements: [
        { id: "p1", name: "placement-1" },
        { id: "p2", name: "placement-2" }
      ],
      selections: { p1: "a/55/1/1" },
      gseqByName: { "placement-1": 1, "placement-2": 2 },
      bids: [
        bidEntry({ provider: "a", gseq: 1, oseq: 1, amount: "1000000" }),
        bidEntry({ provider: "c", gseq: 2, oseq: 1, amount: "2000000" }),
        bidEntry({ provider: "d", gseq: 2, oseq: 1, amount: "5000000" })
      ]
    });
    expect(result.current).toEqual({ minPerBlock: 3, maxPerBlock: 6, denom: "uakt" });
  });

  it("treats a placement with no bids yet as a 0/0 contribution (progressive total)", () => {
    const { result } = setup({
      placements: [
        { id: "p1", name: "placement-1" },
        { id: "p2", name: "placement-2" }
      ],
      gseqByName: { "placement-1": 1, "placement-2": 2 },
      bids: [bidEntry({ provider: "a", gseq: 1, oseq: 1, amount: "4000000" })]
    });
    expect(result.current).toEqual({ minPerBlock: 4, maxPerBlock: 4, denom: "uakt" });
  });

  function setup(input: {
    placements: Array<{ id?: string; name: string }>;
    selections?: Record<string, string>;
    bids: BidEntry[];
    gseqByName?: Record<string, number | undefined>;
  }) {
    const dependencies: typeof DEPENDENCIES = {
      useListBids: () => mock<ReturnType<typeof DEPENDENCIES.useListBids>>({ data: { data: input.bids } }),
      getPlacementGseq: (_sdl: string, name: string) => (input.gseqByName ? input.gseqByName[name] : 1)
    };
    return renderHook(() =>
      useDeploymentCost({ dseq: "55", sdl: "sdl", placements: input.placements, selections: input.selections ?? {} }, dependencies)
    );
  }
});
