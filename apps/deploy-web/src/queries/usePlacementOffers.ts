import { useMemo } from "react";

import { useServices } from "@src/context/ServicesProvider";
import { useProviderList } from "@src/queries/useProvidersQuery";
import type { ScreenedProvider } from "@src/queries/useScreenedProviders";
import { useScreenedProviders } from "@src/queries/useScreenedProviders";
import type { ApiProviderList } from "@src/types/provider";
import { DeploymentGroups } from "@src/utils/deploymentData/helpers";

export type OfferState = "searching" | "submitted" | "unavailable";

/** A screened provider annotated with its on-chain bid status. Extends ScreenedProvider so the marketplace table keeps its existing columns/uptime/sorting. */
export interface PlacementOffer extends ScreenedProvider {
  offerState: OfferState;
  bidId?: string;
  price?: { amount: string; denom: string };
}

interface UsePlacementOffersInput {
  phase: "configuring" | "creating" | "quoting" | "closing" | "error";
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

/** Poll cadence for live bids while quoting; matches the existing phased flow. */
const BID_POLL_INTERVAL = 2000;

/** `listBids` bound to a dseq, enabled only while quoting. Wrapped in DEPENDENCIES so the selector is unit-testable. */
function useListBids(dseq: string | undefined, enabled: boolean) {
  const { api } = useServices();
  return api.v1.listBids.useQuery({ dseq: dseq ?? "" }, { enabled: enabled && !!dseq, refetchInterval: BID_POLL_INTERVAL });
}

/**
 * Resolves a placement's on-chain group sequence (gseq) from the SDL. The chain numbers groups in the order
 * they are submitted in the create-deployment message, which is the order `DeploymentGroups` returns them
 * (both derive from chain-sdk's `buildManifest`), so the gseq is the 1-based index of the group whose name
 * matches the placement. Returns undefined when the SDL is absent/invalid (e.g. mid-edit) or the placement
 * isn't in it, so the caller skips gseq filtering rather than hiding every bid. Wrapped in DEPENDENCIES so the
 * selector is unit-testable without parsing a real SDL.
 */
function getPlacementGseq(sdl: string, placementName: string): number | undefined {
  if (!sdl) return undefined;

  let groups: ReturnType<typeof DeploymentGroups>;
  try {
    groups = DeploymentGroups(sdl);
  } catch {
    return undefined;
  }

  const index = groups.findIndex(group => group.name === placementName);
  return index === -1 ? undefined : index + 1;
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
  const isLocked = phase === "creating" || phase === "quoting" || phase === "closing";
  const isScreening = phase === "configuring" || phase === "creating";
  const screened = dependencies.useScreenedProviders({ sdl, placementName, region, enabled: !isLocked });
  const bidsQuery = dependencies.useListBids(dseq, phase === "quoting");
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
    bidId: toBidId(entry.bid.id),
    price: entry.bid.price
  };
}

/** Stable identifier for a bid across renders, built from its on-chain composite key. */
function toBidId(id: { provider: string; dseq: string; gseq: number; oseq: number }): string {
  return `${id.provider}/${id.dseq}/${id.gseq}/${id.oseq}`;
}
