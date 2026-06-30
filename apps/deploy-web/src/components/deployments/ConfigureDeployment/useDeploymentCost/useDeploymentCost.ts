import { useMemo } from "react";

import { useListBids } from "@src/queries/useListBids";
import { parseBidId } from "@src/utils/bids/bidId";
import { PRICE_DISPLAY_PRECISION, udenomToDenom } from "@src/utils/mathHelpers";
import { getPlacementGseq } from "@src/utils/sdl/placementGseq";

export const DEPENDENCIES = { useListBids, getPlacementGseq };

interface Input {
  dseq: string | null;
  sdl: string;
  placements: ReadonlyArray<{ id?: string; name: string }>;
  selections: Record<string, string>;
}

export interface DeploymentCost {
  /** Summed cheapest per-block price across placements, in denom units. */
  minPerBlock: number;
  /** Summed priciest per-block price across placements, in denom units. */
  maxPerBlock: number;
  denom: string;
}

/** A `listBids` result entry. */
type BidEntry = NonNullable<ReturnType<typeof useListBids>["data"]>["data"][number];

/**
 * The running deployment cost as a per-block `[min, max]` total across placements, or `null` until the first
 * open bid exists. Each placement contributes its selected bid's price (fixed to both bounds) when one is
 * chosen, otherwise the `[cheapest, priciest]` of its open bids, otherwise `[0, 0]` while it has no bids — so
 * the total grows as bids arrive and collapses to a single value once every placement is selected. Reuses the
 * shared `listBids` cache (no extra poll) and the same `gseq` bucketing as `usePlacementsWithBids`, so cost,
 * readiness, and the marketplace never disagree about which bids belong to a placement. The total assumes a
 * single denom per deployment (chain-guaranteed), labelling it with the first open bid's denom like the review
 * modal's total.
 */
export function useDeploymentCost(
  { dseq, sdl, placements, selections }: Input,
  dependencies: typeof DEPENDENCIES = DEPENDENCIES
): DeploymentCost | null {
  const bidsQuery = dependencies.useListBids(dseq);
  const bids = bidsQuery.data?.data;

  return useMemo(
    function buildDeploymentCost(): DeploymentCost | null {
      const openBids = (bids ?? []).filter(entry => entry.bid.state === "open");
      if (openBids.length === 0) return null;

      let minPerBlock = 0;
      let maxPerBlock = 0;
      for (const placement of placements) {
        const [min, max] = placementBounds(placement, openBids, sdl, selections, dependencies.getPlacementGseq);
        minPerBlock += min;
        maxPerBlock += max;
      }
      return { minPerBlock, maxPerBlock, denom: openBids[0].bid.price.denom };
    },
    [bids, placements, sdl, selections, dependencies]
  );
}

/**
 * One placement's per-block `[min, max]`: its selected bid (fixed) when chosen and still open, otherwise its
 * open-bid range, otherwise `[0, 0]`. Bids are bucketed by the placement's `gseq`; when the gseq can't be
 * resolved it falls back to all open bids — the same fallback as `usePlacementsWithBids`, safe here because the
 * spec is frozen and valid while quoting, so every placement's gseq resolves whenever bids exist and the
 * fallback can't double-count across placements in practice. A selection whose bid has since closed degrades
 * to the open range.
 */
function placementBounds(
  placement: { id?: string; name: string },
  openBids: BidEntry[],
  sdl: string,
  selections: Record<string, string>,
  getPlacementGseq: typeof DEPENDENCIES.getPlacementGseq
): [number, number] {
  const gseq = getPlacementGseq(sdl, placement.name);
  const placementBids = openBids.filter(entry => gseq === undefined || entry.bid.id.gseq === gseq);
  if (placementBids.length === 0) return [0, 0];

  const selectedBidId = placement.id ? selections[placement.id] : undefined;
  if (selectedBidId) {
    const selected = parseBidId(selectedBidId);
    const match = placementBids.find(
      entry => entry.bid.id.provider === selected.provider && entry.bid.id.gseq === selected.gseq && entry.bid.id.oseq === selected.oseq
    );
    if (match) {
      const price = udenomToDenom(match.bid.price.amount, PRICE_DISPLAY_PRECISION);
      return [price, price];
    }
  }

  const prices = placementBids.map(entry => udenomToDenom(entry.bid.price.amount, PRICE_DISPLAY_PRECISION));
  return [Math.min(...prices), Math.max(...prices)];
}
