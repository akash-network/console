import type { FC } from "react";

import { usePlacementOffers } from "@src/queries/usePlacementOffers";
import type { DeploymentFlowPhase } from "../useDeploymentFlow/useDeploymentFlow";
import { MarketplaceProvidersTable } from "./MarketplaceProvidersTable/MarketplaceProvidersTable";
import { useProviderSearch } from "./MarketplaceProvidersTable/useProviderSearch/useProviderSearch";
import { ProviderSearchInput } from "./ProviderSearchInput/ProviderSearchInput";

export const DEPENDENCIES = { usePlacementOffers, useProviderSearch, MarketplaceProvidersTable, ProviderSearchInput };

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
  const { offers, isLoading, isError } = d.usePlacementOffers({ phase, dseq: dseq ?? undefined, sdl, placementName, region });
  const { query, setQuery, clear, filteredProviders, isSearchActive } = d.useProviderSearch(offers);
  const hasFailedWithoutData = isError && offers.length === 0;

  return (
    <section aria-labelledby="configure-marketplace-pane-heading" className="flex h-full min-h-0 flex-col">
      <header className="flex h-[52px] shrink-0 items-center justify-between gap-4 px-4 md:border-b md:border-zinc-300 md:dark:border-zinc-700">
        <div className="hidden items-center md:flex">
          <h2 id="configure-marketplace-pane-heading" className="shrink-0 font-mono text-sm font-medium uppercase text-muted-foreground">
            3. Compute Marketplace
          </h2>
          <span className="ml-2 whitespace-nowrap font-mono text-sm font-semibold text-blue-500">• {placementName}</span>
        </div>
        <d.ProviderSearchInput value={query} onChange={setQuery} onClear={clear} />
      </header>
      <div className="flex-1 overflow-y-auto p-4">
        {hasFailedWithoutData ? (
          <p role="alert" className="text-sm text-muted-foreground">
            Failed to load providers. Please try again.
          </p>
        ) : (
          <d.MarketplaceProvidersTable
            providers={filteredProviders}
            isLoading={isLoading}
            isSearchActive={isSearchActive}
            onClearSearch={clear}
            selectedBidId={selectedBidId}
            onSelect={bidId => onSelectProvider(selectedPlacementId, bidId)}
          />
        )}
      </div>
    </section>
  );
};
