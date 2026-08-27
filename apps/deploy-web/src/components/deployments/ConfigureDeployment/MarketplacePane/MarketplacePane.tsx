import type { FC } from "react";
import { useMemo } from "react";

import { useFlag } from "@src/hooks/useFlag";
import { useIsOnboarded } from "@src/hooks/useIsOnboarded";
import { usePlacementOffers } from "@src/queries/usePlacementOffers";
import { hasPlacementVerificationRequirement } from "@src/queries/useScreenedProviders";
import { useDeploymentGpuCount } from "../DeploymentResourceSummary/useDeploymentResourceSummary";
import type { DeploymentFlowPhase } from "../useDeploymentFlow/useDeploymentFlow";
import { MarketplaceProvidersTable } from "./MarketplaceProvidersTable/MarketplaceProvidersTable";
import { useProviderSearch } from "./MarketplaceProvidersTable/useProviderSearch/useProviderSearch";
import { ProviderSearchInput } from "./ProviderSearchInput/ProviderSearchInput";

export const DEPENDENCIES = {
  usePlacementOffers,
  useProviderSearch,
  MarketplaceProvidersTable,
  ProviderSearchInput,
  useDeploymentGpuCount,
  useIsOnboarded,
  useFlag
};

interface Props {
  sdl: string;
  placementName: string;
  region?: string;
  phase: DeploymentFlowPhase;
  dseq: string | null;
  selectedPlacementId: string;
  selectedBidId?: string;
  onSelectProvider: (placementId: string, bidId: string) => void;
  dependencies?: typeof DEPENDENCIES;
}

export const MarketplacePane: FC<Props> = ({
  sdl,
  placementName,
  region,
  phase,
  dseq,
  selectedPlacementId,
  selectedBidId,
  onSelectProvider,
  dependencies: d = DEPENDENCIES
}) => {
  const isProviderVerificationEnabled = d.useFlag("provider_verification");
  const { offers, exclusions, isLoading, isError, isInvalid } = d.usePlacementOffers({
    phase,
    dseq: dseq ?? undefined,
    sdl,
    placementName,
    region,
    verificationEnabled: isProviderVerificationEnabled
  });
  const { query, setQuery, clear, filteredProviders, isSearchActive } = d.useProviderSearch(offers);
  const hasFailedWithoutData = isError && offers.length === 0;
  const verificationRequired = useMemo(() => hasPlacementVerificationRequirement(sdl, placementName), [placementName, sdl]);
  const gpuCount = d.useDeploymentGpuCount(selectedPlacementId);
  /** Provider names link out only once the user is onboarded: the route gate bounces a not-yet-onboarded user back into the funnel, so the link would dead-end. */
  const showProviderLink = d.useIsOnboarded();

  return (
    <section aria-labelledby="configure-marketplace-pane-heading" className="flex h-full min-h-0 flex-col">
      <header className="flex h-[52px] shrink-0 items-center justify-between gap-4 border-b border-zinc-300 px-4 dark:border-zinc-700">
        <div className="flex min-w-0 items-center">
          <h2 id="configure-marketplace-pane-heading" className="shrink-0 font-mono text-sm font-medium uppercase text-muted-foreground">
            3. Compute Marketplace
          </h2>
          <span className="ml-2 min-w-0 truncate font-mono text-sm font-semibold text-blue-500">• {placementName}</span>
        </div>
        <d.ProviderSearchInput value={query} onChange={setQuery} onClear={clear} />
      </header>
      <div className="flex-1 overflow-y-auto p-4">
        {hasFailedWithoutData ? (
          <p role="alert" className="text-sm text-muted-foreground">
            Failed to load providers. Please try again.
          </p>
        ) : isInvalid ? (
          <div role="status" className="flex flex-col items-start gap-1">
            <p className="text-sm font-medium">No providers to show yet</p>
            <p className="text-sm text-muted-foreground">
              This deployment spec isn&apos;t valid, so no provider could bid on it. Fix the highlighted fields to see matching providers.
            </p>
          </div>
        ) : (
          <d.MarketplaceProvidersTable
            providers={filteredProviders}
            exclusions={exclusions}
            verificationEnabled={isProviderVerificationEnabled}
            verificationRequired={verificationRequired}
            isLoading={isLoading}
            isSearchActive={isSearchActive}
            onClearSearch={clear}
            selectedBidId={selectedBidId}
            onSelect={bidId => onSelectProvider(selectedPlacementId, bidId)}
            isSelectable={phase === "quoting"}
            gpuCount={gpuCount}
            showProviderLink={showProviderLink}
          />
        )}
      </div>
    </section>
  );
};
