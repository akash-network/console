import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { PlacementType } from "@src/types";
import type { DEPENDENCIES } from "./useReviewRows";
import { useReviewRows } from "./useReviewRows";

import { renderHook } from "@testing-library/react";

type BidEntry = NonNullable<ReturnType<typeof DEPENDENCIES.useListBids>["data"]>["data"][number];
type ProviderEntry = NonNullable<ReturnType<typeof DEPENDENCIES.useProviderList>["data"]>[number];

describe("useReviewRows", () => {
  it("builds a row per selected placement with provider name and price", () => {
    const { result } = setup({
      placements: [mock<PlacementType>({ id: "p1", name: "placement-1", region: "us-west" })],
      selections: { p1: "akash1a/55/1/2" },
      bids: [mock<BidEntry>({ bid: { id: { provider: "akash1a", dseq: "55", gseq: 1, oseq: 2 }, price: { amount: "100", denom: "uakt" }, state: "open" } })],
      providers: [mock<ProviderEntry>({ owner: "akash1a", organization: "Dune Networks", hostUri: "" })]
    });
    expect(result.current.rows).toEqual([
      expect.objectContaining({
        placementName: "placement-1",
        region: "us-west",
        providerName: "Dune Networks",
        price: expect.objectContaining({ amount: "100", denom: "uakt" })
      })
    ]);
  });

  it("omits placements without a selection and counts priced rows", () => {
    const { result } = setup({
      placements: [mock<PlacementType>({ id: "p1", name: "placement-1" }), mock<PlacementType>({ id: "p2", name: "placement-2" })],
      selections: { p1: "akash1a/55/1/2" },
      bids: [mock<BidEntry>({ bid: { id: { provider: "akash1a", dseq: "55", gseq: 1, oseq: 2 }, price: { amount: "100", denom: "uakt" }, state: "open" } })],
      providers: [mock<ProviderEntry>({ owner: "akash1a", organization: "Dune", hostUri: "" })]
    });
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.pricedCount).toBe(1);
    expect(result.current.totalCount).toBe(2);
  });

  function setup(input: { placements: PlacementType[]; selections: Record<string, string>; bids: BidEntry[]; providers: ProviderEntry[] }) {
    const dependencies: typeof DEPENDENCIES = {
      useListBids: () => mock<ReturnType<typeof DEPENDENCIES.useListBids>>({ data: { data: input.bids } }),
      useProviderList: () => mock<ReturnType<typeof DEPENDENCIES.useProviderList>>({ data: input.providers })
    };
    return renderHook(() => useReviewRows({ dseq: "55", placements: input.placements, selections: input.selections }, dependencies));
  }
});
