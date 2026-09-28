import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { PlacementType } from "@src/types";
import type { ApiProviderList } from "@src/types/provider";
import type { DEPENDENCIES } from "./useReviewRows";
import { useReviewRows } from "./useReviewRows";

import { renderHook } from "@testing-library/react";

type BidEntry = NonNullable<ReturnType<typeof DEPENDENCIES.useListBids>["data"]>["data"][number];

describe("useReviewRows", () => {
  it("builds a row per selected placement with provider name and price", () => {
    const { result } = setup({
      placements: [mock<PlacementType>({ id: "p1", name: "placement-1", region: "us-west" })],
      selections: { p1: "akash1a/55/1/2" },
      bids: [mock<BidEntry>({ bid: { id: { provider: "akash1a", dseq: "55", gseq: 1, oseq: 2 }, price: { amount: "100", denom: "uakt" }, state: "open" } })],
      providers: [mock<ApiProviderList>({ owner: "akash1a", organization: "Dune Networks", hostUri: "" })]
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
      providers: [mock<ApiProviderList>({ owner: "akash1a", organization: "Dune", hostUri: "" })]
    });
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.pricedCount).toBe(1);
    expect(result.current.totalCount).toBe(2);
  });

  it("names a selection by its provider address until the provider is looked up", () => {
    const { result } = setup({
      placements: [mock<PlacementType>({ id: "p1", name: "placement-1" })],
      selections: { p1: "akash1a/55/1/2" },
      bids: [],
      providers: []
    });
    expect(result.current.rows).toEqual([expect.objectContaining({ providerName: "akash1a" })]);
  });

  it("looks up only the providers of the selected bids", () => {
    const { useProvidersByAddresses } = setup({
      placements: [mock<PlacementType>({ id: "p1", name: "placement-1" }), mock<PlacementType>({ id: "p2", name: "placement-2" })],
      selections: { p1: "akash1a/55/1/2" },
      bids: [],
      providers: []
    });
    expect(useProvidersByAddresses).toHaveBeenLastCalledWith(["akash1a"]);
  });

  it("follows a selection changed after the first render", () => {
    const { result, useProvidersByAddresses, rerenderWithSelections } = setup({
      placements: [mock<PlacementType>({ id: "p1", name: "placement-1" })],
      selections: { p1: "akash1a/55/1/2" },
      bids: [],
      providers: [mock<ApiProviderList>({ owner: "akash1b", organization: "Beta", hostUri: "" })]
    });

    rerenderWithSelections({ p1: "akash1b/55/1/2" });

    expect(useProvidersByAddresses).toHaveBeenLastCalledWith(["akash1b"]);
    expect(result.current.rows).toEqual([expect.objectContaining({ providerName: "Beta" })]);
  });

  function setup(input: { placements: PlacementType[]; selections: Record<string, string>; bids: BidEntry[]; providers: ApiProviderList[] }) {
    const useProvidersByAddresses = vi.fn((_addresses: readonly string[]) => ({ data: input.providers, isLoading: false, isFetching: false }));
    const dependencies: typeof DEPENDENCIES = {
      useListBids: () => mock<ReturnType<typeof DEPENDENCIES.useListBids>>({ data: { data: input.bids } }),
      useProvidersByAddresses
    };
    const view = renderHook(({ selections }) => useReviewRows({ dseq: "55", placements: input.placements, selections }, dependencies), {
      initialProps: { selections: input.selections }
    });
    return {
      ...view,
      useProvidersByAddresses,
      rerenderWithSelections(selections: Record<string, string>) {
        view.rerender({ selections });
      }
    };
  }
});
