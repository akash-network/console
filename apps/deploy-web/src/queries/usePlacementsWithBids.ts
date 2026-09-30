import { useMemo } from "react";

import { BID_POLL_INTERVAL, useListBids } from "@src/queries/useListBids";
import { useProvidersByAddresses } from "@src/queries/useProvidersQuery";
import { bidderAddressesToLocate, toBidderRegions } from "@src/utils/bids/bidderRegions";
import { getPlacementGseq } from "@src/utils/sdl/placementGseq";
import { isInPickedRegions } from "@src/utils/sdl/placementRegions";

// eslint-disable-next-line akash/dependencies-component-or-hook
export const DEPENDENCIES = { useListBids, useProvidersByAddresses, getPlacementGseq };

type Placement = { id?: string; name: string; regions?: readonly string[] };

interface Input {
  /** Whether to query bids — the caller enables this while the marketplace is live (quoting). */
  enabled: boolean;
  dseq: string | null;
  sdl: string;
  placements: ReadonlyArray<Placement>;
}

type OpenBid = { bid: { id: { gseq: number; provider: string } } };

/**
 * The set of placement ids that currently have at least one open (selectable) bid. Bids arrive per group and
 * independently, so this lets the UI tell apart a placement that's ready to choose from one still searching —
 * rather than treating the whole deployment as "quoting" the moment any one group gets a bid. Reuses the same
 * `listBids` query as the marketplace, so react-query serves both from one request. A placement picking several
 * regions only counts bids from providers located in them, as its marketplace does.
 */
export function usePlacementsWithBids({ enabled, dseq, sdl, placements }: Input, dependencies: typeof DEPENDENCIES = DEPENDENCIES): Set<string> {
  const bidsQuery = dependencies.useListBids(dseq, { enabled, refetchInterval: BID_POLL_INTERVAL });
  const bids = bidsQuery.data?.data;
  const bidderAddresses = useMemo(() => bidderAddressesToLocate(bids ?? [], placements), [bids, placements]);
  const bidders = dependencies.useProvidersByAddresses(bidderAddresses, { enabled });

  return useMemo(
    function buildPlacementsWithBids() {
      const openBids = (bids ?? []).filter(entry => entry.bid.state === "open");
      if (openBids.length === 0) return new Set<string>();
      return placementIdsWithOpenBids(placements, openBids, sdl, dependencies.getPlacementGseq, toBidderRegions(bidders.data));
    },
    [bids, bidders.data, placements, sdl, dependencies]
  );
}

/**
 * Placement ids whose on-chain group (gseq, resolved from the SDL) matches at least one of the open bids.
 * When the gseq can't be resolved (absent/invalid SDL, or the placement isn't in it), it falls back to
 * "has bids if any open bid exists" — the same fallback as `usePlacementOffers`, so the readiness state
 * and the marketplace offers never disagree for that placement. Called only with a non-empty `openBids`.
 */
function placementIdsWithOpenBids(
  placements: Input["placements"],
  openBids: ReadonlyArray<OpenBid>,
  sdl: string,
  getPlacementGseq: typeof DEPENDENCIES.getPlacementGseq,
  bidderRegions: Map<string, string | null>
): Set<string> {
  const withBids = new Set<string>();
  for (const placement of placements) {
    if (!placement.id) continue;
    const gseq = getPlacementGseq(sdl, placement.name);
    const hasOpenBid = openBids.some(
      entry => (gseq === undefined || entry.bid.id.gseq === gseq) && isInPickedRegions(placement.regions, bidderRegions.get(entry.bid.id.provider))
    );
    if (hasOpenBid) withBids.add(placement.id);
  }
  return withBids;
}
