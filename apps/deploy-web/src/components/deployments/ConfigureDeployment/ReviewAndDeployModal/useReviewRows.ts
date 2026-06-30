import { useMemo } from "react";

import { useListBids } from "@src/queries/useListBids";
import { useProviderList } from "@src/queries/useProvidersQuery";
import type { PlacementType } from "@src/types";
import { type BidId, parseBidId } from "@src/utils/bids/bidId";
import { providerDisplayName } from "@src/utils/providerUtils";

export interface ReviewRow {
  placementId: string;
  placementName: string;
  region?: string;
  providerName: string;
  price?: { amount: string; denom: string };
}

export const DEPENDENCIES = { useListBids, useProviderList };

interface Input {
  dseq: string | null;
  placements: PlacementType[];
  selections: Record<string, string>;
}

/** Joins the per-placement selection (a bid id) to its live bid (price) and provider record (name) to drive the review modal. */
export function useReviewRows({ dseq, placements, selections }: Input, dependencies: typeof DEPENDENCIES = DEPENDENCIES) {
  const bidsQuery = dependencies.useListBids(dseq);
  const providerListQuery = dependencies.useProviderList({ enabled: true });

  return useMemo(() => {
    const bids = bidsQuery.data?.data ?? [];
    const providersByOwner = new Map((providerListQuery.data ?? []).map(p => [p.owner, p]));

    const rows: ReviewRow[] = placements
      .filter(placement => selections[placement.id])
      .map(placement => {
        const bidId = selections[placement.id];
        const parsed = parseBidId(bidId);
        const match = findOpenBidForSelection(bids, parsed);
        const provider = providersByOwner.get(parsed.provider);
        return {
          placementId: placement.id,
          placementName: placement.name,
          region: placement.region || undefined,
          providerName: provider ? providerDisplayName(provider) : parsed.provider,
          price: match?.bid.price
        };
      });

    return { rows, pricedCount: rows.filter(r => !!r.price).length, totalCount: placements.length };
  }, [bidsQuery.data, providerListQuery.data, placements, selections]);
}

/** A `listBids` result entry. */
type BidEntry = NonNullable<ReturnType<typeof useListBids>["data"]>["data"][number];

/**
 * The open (selectable) live bid matching a selection — matched on provider plus group/order sequence and
 * open state. `dseq` is intentionally not compared: the bids are already scoped to one deployment by the
 * dseq-keyed `listBids` query.
 */
function findOpenBidForSelection(bids: BidEntry[], selected: BidId): BidEntry | undefined {
  return bids.find(
    entry =>
      entry.bid.state === "open" && entry.bid.id.provider === selected.provider && entry.bid.id.gseq === selected.gseq && entry.bid.id.oseq === selected.oseq
  );
}
