import { useMemo } from "react";

import { BID_POLL_INTERVAL, useListBids } from "@src/queries/useListBids";
import { useProviderList } from "@src/queries/useProvidersQuery";
import type { ScreenedProvider } from "@src/queries/useScreenedProviders";
import { useScreenedProviders } from "@src/queries/useScreenedProviders";
import type { ApiProviderList } from "@src/types/provider";
import { formatBidId } from "@src/utils/bids/bidId";
import { getPlacementGseq } from "@src/utils/sdl/placementGseq";

export type OfferState = "searching" | "submitted" | "unavailable";

/** A screened provider annotated with its on-chain bid status. Extends ScreenedProvider so the marketplace table keeps its existing columns/uptime/sorting. */
export interface PlacementOffer extends ScreenedProvider {
  offerState: OfferState;
  bidId?: string;
  price?: { amount: string; denom: string };
}

interface UsePlacementOffersInput {
  phase: "configuring" | "creating" | "quoting" | "closing" | "deploying" | "error";
  dseq?: string;
  sdl: string;
  placementName: string;
  region?: string;
}

interface UsePlacementOffersResult {
  offers: PlacementOffer[];
  isLoading: boolean;
  isError: boolean;
}

export const DEPENDENCIES = { useScreenedProviders, useListBids, useProviderList, getPlacementGseq };

/**
 * The shared offers seam, read by both the marketplace pane and the lifecycle hook so they can never
 * disagree about which offers exist. It surfaces one source at a time, never a merge of the two:
 *
 * - While screening (`configuring`/`creating`) it returns the screened providers as `searching` offers —
 *   the candidate pool for the current spec.
 * - Otherwise (`quoting`/`closing`/`error`) it returns the placement's open bids as `submitted` offers
 *   once any have arrived; until the first bid it keeps showing the screened candidates as `searching`,
 *   so the marketplace is never blank while bids are still coming in. Bids are shaped like a screened
 *   provider so the table renders them identically; the provider list supplies each bid's name
 *   (organization, else host), region and audited flag so a bid reads the same as a screened result.
 *
 * Once the deployment is locked (`creating`/`quoting`/`closing`) the spec is frozen, so screening is paused
 * (the CPU-heavy query stops re-running against an unchanging spec); the last screened set is kept as the
 * pre-bid fallback. `listBids` returns every bid for the deployment across all its groups, so bids are
 * scoped to this placement by its group sequence (`gseq`): only open bids whose `gseq` matches are kept,
 * so a provider that bid on a different placement's group is not surfaced here.
 *
 * `isLoading`/`isError` follow the source that's driving the view: the screened query normally, plus the
 * `listBids` query while quoting — so a failing or still-loading bids request surfaces instead of silently
 * sitting on stale offers. Bids loading only counts when there is nothing to show yet, so the screened
 * pre-bid fallback is never replaced by a spinner.
 */
export function usePlacementOffers(
  { phase, dseq, sdl, placementName, region }: UsePlacementOffersInput,
  dependencies: typeof DEPENDENCIES = DEPENDENCIES
): UsePlacementOffersResult {
  const isLocked = phase === "creating" || phase === "quoting" || phase === "closing" || phase === "deploying";
  const isScreening = phase === "configuring" || phase === "creating";
  const screened = dependencies.useScreenedProviders({ sdl, placementName, region, enabled: !isLocked });
  const bidsQuery = dependencies.useListBids(dseq, { enabled: phase === "quoting", refetchInterval: BID_POLL_INTERVAL });
  const providerListQuery = dependencies.useProviderList({ enabled: !isScreening });
  const gseq = useMemo(() => dependencies.getPlacementGseq(sdl, placementName), [dependencies, sdl, placementName]);
  const providersByOwner = useMemo(() => new Map((providerListQuery.data ?? []).map(provider => [provider.owner, provider])), [providerListQuery.data]);

  const offers = useMemo(
    function buildOffers(): PlacementOffer[] {
      const openBids = isScreening
        ? []
        : (bidsQuery.data?.data ?? []).filter(entry => entry.bid.state === "open" && (gseq === undefined || entry.bid.id.gseq === gseq));
      return openBids.length > 0
        ? openBids.map(entry => toBidOffer(entry, providersByOwner.get(entry.bid.id.provider)))
        : screened.providers.map(toSearchingOffer);
    },
    [isScreening, screened.providers, bidsQuery.data, gseq, providersByOwner]
  );

  const isQuoting = phase === "quoting";
  return {
    offers,
    isLoading: screened.isLoading || (isQuoting && offers.length === 0 && bidsQuery.isLoading),
    isError: screened.isError || (isQuoting && bidsQuery.isError)
  };
}

/** A screened provider as a not-yet-bid offer — the candidate pool shown while screening. */
function toSearchingOffer(provider: ScreenedProvider): PlacementOffer {
  return { ...provider, offerState: "searching", bidId: undefined, price: undefined };
}

/**
 * An open bid as an offer, shaped like a screened provider so the marketplace table renders it the same
 * way. The bid carries only the provider address and price; the provider record (when loaded) supplies
 * the name (organization, else host), region and audited flag so a bid reads like a screened result.
 * Uptime is left to the table's neutral fallback — the provider record doesn't carry the per-day
 * incident history the screened uptime is derived from.
 */
function toBidOffer(
  entry: { bid: { id: { provider: string; dseq: string; gseq: number; oseq: number }; price: { amount: string; denom: string } } },
  provider?: ApiProviderList
): PlacementOffer {
  return {
    owner: entry.bid.id.provider,
    hostUri: provider?.hostUri ?? "",
    isAudited: provider?.isAudited ?? false,
    createdAt: "",
    location: provider?.locationRegion || null,
    organization: provider?.organization || null,
    incidents: [],
    offerState: "submitted",
    bidId: formatBidId(entry.bid.id),
    price: entry.bid.price
  };
}
