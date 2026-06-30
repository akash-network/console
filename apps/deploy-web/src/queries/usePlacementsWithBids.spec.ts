import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

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

  function setup(input: { gseqByName: Record<string, number>; placements: { id: string; name: string }[]; bids: { gseq: number; state: string }[] }) {
    const dependencies: typeof DEPENDENCIES = {
      useListBids: () =>
        mock<ReturnType<typeof DEPENDENCIES.useListBids>>({ data: { data: input.bids.map(bid => ({ bid: { id: { gseq: bid.gseq }, state: bid.state } })) } }),
      getPlacementGseq: (_sdl, name) => input.gseqByName[name]
    };
    return renderHook(() => usePlacementsWithBids({ enabled: true, dseq: "55", sdl: "sdl", placements: input.placements }, dependencies));
  }
});
