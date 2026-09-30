import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ApiProviderList } from "@src/types/provider";
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
      bids: [bidEntry({ provider: "a", gseq: 1, oseq: 1, amount: "1000000" }), bidEntry({ provider: "b", gseq: 1, oseq: 1, amount: "3000000" })]
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
      bids: [bidEntry({ provider: "a", gseq: 1, oseq: 1, amount: "1000000" }), bidEntry({ provider: "b", gseq: 1, oseq: 1, amount: "3000000" })]
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

  describe("when a placement picks several regions", () => {
    it("ranges only over the open bids of providers located in them", () => {
      const { result } = setup({
        placements: [{ id: "p1", name: "placement-1", regions: ["eu-west", "na-us-west"] }],
        bids: [
          bidEntry({ provider: "west", gseq: 1, oseq: 1, amount: "2000000" }),
          bidEntry({ provider: "central", gseq: 1, oseq: 1, amount: "1000000" }),
          bidEntry({ provider: "uswest", gseq: 1, oseq: 1, amount: "5000000" }),
          bidEntry({ provider: "unlocated", gseq: 1, oseq: 1, amount: "9000000" })
        ],
        providers: [
          { owner: "west", locationRegion: "eu-west" },
          { owner: "central", locationRegion: "eu-central" },
          { owner: "uswest", locationRegion: "na-us-west" }
        ]
      });

      expect(result.current).toEqual({ minPerBlock: 2, maxPerBlock: 5, denom: "uakt" });
    });

    it("keeps ranging over every open bid of a placement picking one region", () => {
      const { result } = setup({
        placements: [
          { id: "p1", name: "placement-1", regions: ["eu-west"] },
          { id: "p2", name: "placement-2", regions: ["eu-west", "na-us-west"] }
        ],
        gseqByName: { "placement-1": 1, "placement-2": 2 },
        bids: [bidEntry({ provider: "central", gseq: 1, oseq: 1, amount: "1000000" })],
        providers: [{ owner: "central", locationRegion: "eu-central" }]
      });

      expect(result.current).toEqual({ minPerBlock: 1, maxPerBlock: 1, denom: "uakt" });
    });

    it("looks up every bidder", () => {
      const { useProvidersByAddresses } = setup({
        placements: [{ id: "p1", name: "placement-1", regions: ["eu-west", "na-us-west"] }],
        bids: [bidEntry({ provider: "west", gseq: 1, oseq: 1, amount: "2000000" }), bidEntry({ provider: "east", gseq: 1, oseq: 1, amount: "2000000" })]
      });

      expect(useProvidersByAddresses).toHaveBeenLastCalledWith(["west", "east"]);
    });
  });

  it("follows bids and bidders that arrive after the first render", () => {
    const { result, useProvidersByAddresses, rerenderWithBids } = setup({
      placements: [{ id: "p1", name: "placement-1", regions: ["eu-west", "na-us-west"] }],
      bids: [],
      providers: [{ owner: "west", locationRegion: "eu-west" }]
    });
    expect(result.current).toBeNull();

    rerenderWithBids([bidEntry({ provider: "west", gseq: 1, oseq: 1, amount: "2000000" })]);

    expect(useProvidersByAddresses).toHaveBeenLastCalledWith(["west"]);
    expect(result.current).toEqual({ minPerBlock: 2, maxPerBlock: 2, denom: "uakt" });
  });

  it("looks up no bidder while no placement picks several regions", () => {
    const { useProvidersByAddresses } = setup({
      placements: [{ id: "p1", name: "placement-1", regions: ["eu-west"] }],
      bids: [bidEntry({ provider: "west", gseq: 1, oseq: 1, amount: "2000000" })]
    });

    expect(useProvidersByAddresses).toHaveBeenLastCalledWith([]);
  });

  function setup(input: {
    placements: Array<{ id?: string; name: string; regions?: string[] }>;
    selections?: Record<string, string>;
    bids: BidEntry[];
    gseqByName?: Record<string, number | undefined>;
    providers?: Pick<ApiProviderList, "owner" | "locationRegion">[];
  }) {
    const providersLookup = { data: (input.providers ?? []).map(provider => mock<ApiProviderList>(provider)), isLoading: false, isFetching: false };
    const useProvidersByAddresses = vi.fn<typeof DEPENDENCIES.useProvidersByAddresses>(() => providersLookup);
    const toBidsQuery = (bids: BidEntry[]) => mock<ReturnType<typeof DEPENDENCIES.useListBids>>({ data: { data: bids } });
    let bidsQuery = toBidsQuery(input.bids);
    const dependencies: typeof DEPENDENCIES = {
      useListBids: () => bidsQuery,
      useProvidersByAddresses,
      getPlacementGseq: (_sdl: string, name: string) => (input.gseqByName ? input.gseqByName[name] : 1)
    };
    const view = renderHook(() =>
      useDeploymentCost({ dseq: "55", sdl: "sdl", placements: input.placements, selections: input.selections ?? {} }, dependencies)
    );
    return {
      ...view,
      useProvidersByAddresses,
      rerenderWithBids(bids: BidEntry[]) {
        bidsQuery = toBidsQuery(bids);
        view.rerender();
      }
    };
  }
});
