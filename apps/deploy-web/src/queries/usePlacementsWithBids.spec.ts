import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ApiProviderList } from "@src/types/provider";
import type { DEPENDENCIES } from "./usePlacementsWithBids";
import { usePlacementsWithBids } from "./usePlacementsWithBids";

import { renderHook } from "@testing-library/react";

describe("usePlacementsWithBids", () => {
  it("includes only placements whose group has an open bid", () => {
    const { result } = setup({
      gseqByName: { "placement-1": 1, "placement-2": 2 },
      placements: [
        { id: "p1", name: "placement-1" },
        { id: "p2", name: "placement-2" }
      ],
      bids: [{ gseq: 1, state: "open" }]
    });
    expect(result.current.has("p1")).toBe(true);
    expect(result.current.has("p2")).toBe(false);
  });

  it("ignores closed bids", () => {
    const { result } = setup({
      gseqByName: { "placement-1": 1 },
      placements: [{ id: "p1", name: "placement-1" }],
      bids: [{ gseq: 1, state: "closed" }]
    });
    expect(result.current.has("p1")).toBe(false);
  });

  it("is empty before any bid arrives", () => {
    const { result } = setup({ gseqByName: { "placement-1": 1 }, placements: [{ id: "p1", name: "placement-1" }], bids: [] });
    expect(result.current.size).toBe(0);
  });

  it("includes a placement with an unresolved gseq when any open bid exists, matching usePlacementOffers", () => {
    const { result } = setup({ gseqByName: {}, placements: [{ id: "p1", name: "placement-1" }], bids: [{ gseq: 7, state: "open" }] });
    expect(result.current.has("p1")).toBe(true);
  });

  describe("when a placement picks several regions", () => {
    it("counts only the open bids of providers located in them", () => {
      const { result } = setup({
        gseqByName: { "placement-1": 1, "placement-2": 2 },
        placements: [
          { id: "p1", name: "placement-1", regions: ["eu-west", "na-us-west"] },
          { id: "p2", name: "placement-2", regions: ["eu-west", "na-us-west"] }
        ],
        bids: [
          { gseq: 1, state: "open", provider: "akash1central" },
          { gseq: 2, state: "open", provider: "akash1uswest" }
        ],
        providers: [
          { owner: "akash1central", locationRegion: "eu-central" },
          { owner: "akash1uswest", locationRegion: "na-us-west" }
        ]
      });

      expect(result.current.has("p1")).toBe(false);
      expect(result.current.has("p2")).toBe(true);
    });

    it("leaves out a bid whose provider is not located yet", () => {
      const { result } = setup({
        gseqByName: { "placement-1": 1 },
        placements: [{ id: "p1", name: "placement-1", regions: ["eu-west", "na-us-west"] }],
        bids: [{ gseq: 1, state: "open", provider: "akash1pending" }],
        providers: []
      });

      expect(result.current.has("p1")).toBe(false);
    });

    it("keeps counting every bid for a placement that picks one region", () => {
      const { result } = setup({
        gseqByName: { "placement-1": 1, "placement-2": 2 },
        placements: [
          { id: "p1", name: "placement-1", regions: ["eu-west"] },
          { id: "p2", name: "placement-2", regions: ["eu-west", "na-us-west"] }
        ],
        bids: [{ gseq: 1, state: "open", provider: "akash1central" }],
        providers: [{ owner: "akash1central", locationRegion: "eu-central" }]
      });

      expect(result.current.has("p1")).toBe(true);
    });

    it("looks up every bidder while bids are queried", () => {
      const { useProvidersByAddresses } = setup({
        gseqByName: { "placement-1": 1 },
        placements: [{ id: "p1", name: "placement-1", regions: ["eu-west", "na-us-west"] }],
        bids: [
          { gseq: 1, state: "open", provider: "akash1aaa" },
          { gseq: 1, state: "closed", provider: "akash1bbb" }
        ],
        enabled: false
      });

      expect(useProvidersByAddresses).toHaveBeenLastCalledWith(["akash1aaa", "akash1bbb"], { enabled: false });
    });
  });

  it("follows bids and bidders that arrive after the first render", () => {
    const { result, useProvidersByAddresses, rerenderWithBids } = setup({
      gseqByName: { "placement-1": 1 },
      placements: [{ id: "p1", name: "placement-1", regions: ["eu-west", "na-us-west"] }],
      bids: [],
      providers: [{ owner: "akash1west", locationRegion: "eu-west" }]
    });
    expect(result.current.has("p1")).toBe(false);

    rerenderWithBids([{ gseq: 1, state: "open", provider: "akash1west" }]);

    expect(useProvidersByAddresses).toHaveBeenLastCalledWith(["akash1west"], { enabled: true });
    expect(result.current.has("p1")).toBe(true);
  });

  it("looks up no bidder while no placement picks several regions", () => {
    const { useProvidersByAddresses } = setup({
      gseqByName: { "placement-1": 1 },
      placements: [{ id: "p1", name: "placement-1", regions: ["eu-west"] }],
      bids: [{ gseq: 1, state: "open", provider: "akash1aaa" }]
    });

    expect(useProvidersByAddresses).toHaveBeenLastCalledWith([], { enabled: true });
  });

  function setup(input: {
    gseqByName: Record<string, number>;
    placements: { id: string; name: string; regions?: string[] }[];
    bids: { gseq: number; state: string; provider?: string }[];
    providers?: Pick<ApiProviderList, "owner" | "locationRegion">[];
    enabled?: boolean;
  }) {
    const providersLookup = { data: (input.providers ?? []).map(provider => mock<ApiProviderList>(provider)), isLoading: false, isFetching: false };
    const useProvidersByAddresses = vi.fn<typeof DEPENDENCIES.useProvidersByAddresses>(() => providersLookup);
    const toBidsQuery = (bids: typeof input.bids) =>
      mock<ReturnType<typeof DEPENDENCIES.useListBids>>({
        data: { data: bids.map(bid => ({ bid: { id: { gseq: bid.gseq, provider: bid.provider ?? "akash1any" }, state: bid.state } })) }
      });
    let bidsQuery = toBidsQuery(input.bids);
    const dependencies: typeof DEPENDENCIES = {
      useListBids: () => bidsQuery,
      useProvidersByAddresses,
      getPlacementGseq: (_sdl, name) => input.gseqByName[name]
    };
    const placements = input.placements;
    const view = renderHook(() => usePlacementsWithBids({ enabled: input.enabled ?? true, dseq: "55", sdl: "sdl", placements }, dependencies));
    return {
      ...view,
      useProvidersByAddresses,
      rerenderWithBids(bids: typeof input.bids) {
        bidsQuery = toBidsQuery(bids);
        view.rerender();
      }
    };
  }
});
