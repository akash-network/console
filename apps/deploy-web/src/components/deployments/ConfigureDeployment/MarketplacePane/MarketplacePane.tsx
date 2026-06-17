import type { FC } from "react";

import { useScreenedProviders } from "@src/queries/useScreenedProviders";
import { MarketplaceProvidersTable } from "./MarketplaceProvidersTable/MarketplaceProvidersTable";
import { useProviderSearch } from "./MarketplaceProvidersTable/useProviderSearch/useProviderSearch";
import { ProviderSearchInput } from "./ProviderSearchInput/ProviderSearchInput";

export const DEPENDENCIES = { useScreenedProviders, useProviderSearch, MarketplaceProvidersTable, ProviderSearchInput };

interface Props {
  sdl: string;
  placementName: string;
  region?: string;
  dependencies?: typeof DEPENDENCIES;
}

export const MarketplacePane: FC<Props> = ({ sdl, placementName, region, dependencies: d = DEPENDENCIES }) => {
  const { providers, isLoading, isError } = d.useScreenedProviders({ sdl, placementName, region });
  const { query, setQuery, clear, filteredProviders, isSearchActive } = d.useProviderSearch(providers);
  const hasFailedWithoutData = isError && providers.length === 0;

  return (
    <section aria-labelledby="configure-marketplace-pane-heading" className="flex h-full min-h-0 flex-col">
      <header className="flex h-[52px] shrink-0 items-center justify-between gap-4 px-4 md:border-b md:border-zinc-300 md:dark:border-zinc-700">
        <div className="hidden items-center md:flex">
          <h2 id="configure-marketplace-pane-heading" className="font-mono text-sm font-medium uppercase text-muted-foreground">
            3. Compute Marketplace
          </h2>
          <span className="ml-2 font-mono text-sm font-semibold text-blue-500">• {placementName}</span>
        </div>
        <d.ProviderSearchInput value={query} onChange={setQuery} onClear={clear} />
      </header>
      <div className="flex-1 overflow-y-auto p-4">
        {hasFailedWithoutData ? (
          <p role="alert" className="text-sm text-muted-foreground">
            Failed to load providers. Please try again.
          </p>
        ) : (
          <d.MarketplaceProvidersTable providers={filteredProviders} isLoading={isLoading} isSearchActive={isSearchActive} onClearSearch={clear} />
        )}
      </div>
    </section>
  );
};
