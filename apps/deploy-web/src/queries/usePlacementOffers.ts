import { useMemo } from "react";

import { BID_POLL_INTERVAL, useListBids } from "@src/queries/useListBids";
import { useProviderList } from "@src/queries/useProvidersQuery";
import type { ScreenedProvider } from "@src/queries/useScreenedProviders";
import { useScreenedProviders } from "@src/queries/useScreenedProviders";
import type { ApiProviderList } from "@src/types/provider";
import { formatBidId } from "@src/utils/bids/bidId";
import { getPlacementGseq } from "@src/utils/sdl/placementGseq";

export type OfferState = "searching" | "submitted" | "closed" | "unavailable";

/** A screened provider annotated with its on-chain bid status. Extends ScreenedProvider so the marketplace table keeps its existing columns/uptime/sorting. */
export interface PlacementOffer extends ScreenedProvider {
  offerState: OfferState;
  bidId?: string;
  price?: { amount: string; denom: string };
}

/** One deployment bid from listBids, derived from the query result so it can't drift from the SDK's bid shape (matches the sibling quote hooks). */
type BidEntry = NonNullable<ReturnType<typeof useListBids>["data"]>["data"][number];

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
  /** True while still configuring a spec that can't be screened — the marketplace shows a message instead of a list. */
  isInvalid: boolean;
}

export const DEPENDENCIES = { useScreenedProviders, useListBids, useProviderList, getPlacementGseq };

/**
 * The shared offers seam, read by the marketplace pane so screening and bids can never disagree about which
 * offers exist.
 *
 * - While screening (`configuring`/`creating`) it returns the screened providers as `searching` offers.
 * - Otherwise, until this placement's first bid arrives, it keeps showing the screened candidates as
 *   `searching`, so the marketplace is never blank while bids are still coming in.
 * - Once bids exist it returns a 1:1 merge of the screened pool with the bids, deduplicated by provider
 *   address: an open bid is `submitted` (priced, selectable), a closed bid is `closed`, and a screened
 *   provider that never bid is `unavailable`. A provider that bid without being screened is still included.
 *   Screened metadata (name, region, audited flag, incident-derived uptime) is reused for any provider that
 *   was screened; the provider list only fills in a bidder that was never screened.
 *
 * Once the deployment is locked (`creating`/`quoting`/`closing`/`deploying`) screening is paused and the last
 * screened set is kept (`keepPreviousData`) as both the pre-bid fallback and the metadata source. `listBids`
 * returns every bid for the deployment across its groups, so bids are scoped to this placement by its group
 * sequence (`gseq`).
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
  const screenedByOwner = useMemo(() => new Map(screened.providers.map(provider => [provider.owner, provider])), [screened.providers]);

  const offers = useMemo(
    function buildOffers(): PlacementOffer[] {
      if (isScreening) return screened.providers.map(toSearchingOffer);

      const placementBids = (bidsQuery.data?.data ?? []).filter(entry => gseq === undefined || entry.bid.id.gseq === gseq);
      if (placementBids.length === 0) return screened.providers.map(toSearchingOffer);

      const bidByOwner = pickBestBidPerOwner(placementBids);
      return mergedOwners(screened.providers, bidByOwner).map(function toMergedOffer(owner): PlacementOffer {
        const meta = screenedByOwner.get(owner) ?? providerListToOffer(owner, providersByOwner.get(owner));
        const entry = bidByOwner.get(owner);
        if (entry?.bid.state === "open") return { ...meta, offerState: "submitted", bidId: formatBidId(entry.bid.id), price: entry.bid.price };
        if (entry) return { ...meta, offerState: "closed", bidId: undefined, price: entry.bid.price };
        return { ...meta, offerState: "unavailable", bidId: undefined, price: undefined };
      });
    },
    [isScreening, screened.providers, screenedByOwner, bidsQuery.data, gseq, providersByOwner]
  );

  const isQuoting = phase === "quoting";
  return {
    offers,
    isLoading: screened.isLoading || (isQuoting && offers.length === 0 && bidsQuery.isLoading),
    isError: screened.isError || (isQuoting && bidsQuery.isError),
    isInvalid: !isLocked && screened.isInvalid
  };
}

/** A screened provider as a not-yet-bid offer — shown while screening and before this placement's first bid. */
function toSearchingOffer(provider: ScreenedProvider): PlacementOffer {
  return { ...provider, offerState: "searching", bidId: undefined, price: undefined };
}

/** The best bid per provider address: an open bid always wins over a closed one so a re-bidding provider stays selectable. */
function pickBestBidPerOwner(entries: BidEntry[]): Map<string, BidEntry> {
  const byOwner = new Map<string, BidEntry>();
  for (const entry of entries) {
    const existing = byOwner.get(entry.bid.id.provider);
    if (!existing || (existing.bid.state !== "open" && entry.bid.state === "open")) byOwner.set(entry.bid.id.provider, entry);
  }
  return byOwner;
}

/** Screened owners first (deduped by address, first-seen order), then any bidder that was never screened, so the merge is a 1:1 superset of the screened pool with no repeated rows. */
function mergedOwners(screened: ScreenedProvider[], bidByOwner: Map<string, BidEntry>): string[] {
  const owners: string[] = [];
  const seen = new Set<string>();
  for (const provider of screened) {
    if (!seen.has(provider.owner)) {
      owners.push(provider.owner);
      seen.add(provider.owner);
    }
  }
  for (const owner of bidByOwner.keys()) {
    if (!seen.has(owner)) {
      owners.push(owner);
      seen.add(owner);
    }
  }
  return owners;
}

/**
 * A screened-provider-shaped record for a bidder that was never screened, so the table renders it identically.
 * The provider list (when loaded) supplies the name (organization, else host), region and audited flag; uptime
 * is left to the table's neutral fallback since the provider record carries no per-day incident history.
 */
function providerListToOffer(owner: string, provider?: ApiProviderList): ScreenedProvider {
  return {
    owner,
    hostUri: provider?.hostUri ?? "",
    isAudited: provider?.isAudited ?? false,
    createdAt: "",
    location: provider?.locationRegion || null,
    organization: provider?.organization || null,
    incidents: []
  };
}
