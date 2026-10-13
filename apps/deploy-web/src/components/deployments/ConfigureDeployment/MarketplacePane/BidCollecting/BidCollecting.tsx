"use client";
import type { FC } from "react";
import { useMemo } from "react";
import { CircleCheckIcon } from "lucide-react";

import type { PlacementOffer } from "@src/queries/usePlacementOffers";
import { useProviderLocations } from "@src/queries/useProvidersQuery";
import type { ApiProviderLocation } from "@src/types/provider";
import { providerDisplayName } from "@src/utils/providerUtils";
import type { DeploymentFlowPhase } from "../../useDeploymentFlow/useDeploymentFlow";
import { BidCollectingGlobe } from "./BidCollectingGlobe";
import { describeBidCollectingStep, expectedBidProgress } from "./bidCollectingStatus";
import type { LocatedProvider } from "./bidGlobeScene";
import { useBidCollectingClock } from "./useBidCollectingClock";

export const DEPENDENCIES = { useProviderLocations, useBidCollectingClock, BidCollectingGlobe };

interface Props {
  phase: DeploymentFlowPhase;
  providers: PlacementOffer[];
  placementName: string;
  bidder: PlacementOffer | null;
  dependencies?: typeof DEPENDENCIES;
}

export const BidCollecting: FC<Props> = ({ phase, providers, placementName, bidder, dependencies: d = DEPENDENCIES }) => {
  const { data: locations } = d.useProviderLocations();
  const { msSinceStart, msSinceQuoting } = d.useBidCollectingClock(phase, !bidder);
  const locatedProviders = useMemo(() => locateProviders(providers, locations), [providers, locations]);
  const regionCount = new Set(providers.flatMap(provider => (provider.location ? [provider.location] : []))).size;
  const step = describeBidCollectingStep({ msSinceQuoting, providerCount: providers.length, regionCount, placementName });
  const progress = bidder ? 100 : expectedBidProgress(msSinceStart);

  return (
    <div
      data-bid-received={!!bidder}
      className="group flex min-h-[340px] flex-1 flex-col items-center justify-center gap-5 px-4 pb-12 pt-8 duration-300 animate-in fade-in slide-in-from-bottom-1 data-[bid-received=true]:delay-700 data-[bid-received=true]:duration-200 data-[bid-received=true]:animate-out data-[bid-received=true]:fade-out data-[bid-received=true]:fill-mode-forwards motion-reduce:animate-none"
    >
      <d.BidCollectingGlobe providers={locatedProviders} bidderId={bidder?.owner ?? null} seed={placementName} />
      <div className="flex max-w-[360px] flex-col items-center gap-1.5 text-center">
        <p role="status" className="inline-flex items-center gap-2 text-base font-semibold tracking-tight">
          {bidder && <CircleCheckIcon className="h-4 w-4 text-green-600" aria-hidden="true" />}
          {bidder ? "First bid received" : "Collecting bids"}
        </p>
        <p key={bidder ? "bidder" : step} className="min-h-5 text-sm text-muted-foreground duration-300 animate-in fade-in slide-in-from-bottom-1 motion-reduce:animate-none">
          {bidder ? `From ${providerDisplayName(bidder)}` : step}
        </p>
        <div
          role="progressbar"
          aria-label="Collecting bids"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          className="mt-2.5 h-[3px] w-[180px] overflow-hidden rounded-sm bg-border"
        >
          <div
            className="h-full rounded-[inherit] bg-foreground transition-[width] duration-150 ease-linear group-data-[bid-received=true]:bg-green-500 group-data-[bid-received=true]:duration-200 group-data-[bid-received=true]:ease-out"
            style={{ width: `${progress.toFixed(1)}%` }}
          />
        </div>
      </div>
    </div>
  );
};

type ProviderCoordinates = Pick<ApiProviderLocation, "owner" | "ipLat" | "ipLon">;

/** Providers the location list has no coordinates for are left off the globe rather than placed somewhere made up. */
function locateProviders(providers: PlacementOffer[], locations: ProviderCoordinates[] | undefined): LocatedProvider[] {
  const locationByOwner = new Map(locations?.map(location => [location.owner, location]));
  return providers.flatMap(provider => {
    const location = locationByOwner.get(provider.owner);
    const lat = Number.parseFloat(location?.ipLat ?? "");
    const lng = Number.parseFloat(location?.ipLon ?? "");
    return Number.isFinite(lat) && Number.isFinite(lng) ? [{ id: provider.owner, lat, lng }] : [];
  });
}
