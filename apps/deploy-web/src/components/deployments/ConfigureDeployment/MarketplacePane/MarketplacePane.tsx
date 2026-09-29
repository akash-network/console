import type { FC, ReactNode } from "react";
import { useCallback, useEffect, useRef } from "react";
import { LoaderCircleIcon } from "lucide-react";

import { useIsOnboarded } from "@src/hooks/useIsOnboarded";
import { useGpuModels } from "@src/queries/useGpuQuery";
import { usePlacementOffers } from "@src/queries/usePlacementOffers";
import { useDeploymentCpuArch, useDeploymentGpuCount } from "../DeploymentResourceSummary/useDeploymentResourceSummary";
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
  useDeploymentCpuArch,
  useIsOnboarded,
  useGpuModels
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
  /** `expanded` is the full-width picker of the two panel layout: rows select their offer and the placement chips sit under the header. */
  variant?: "pane" | "expanded";
  chips?: ReactNode;
  dependencies?: typeof DEPENDENCIES;
}

/** A pick lands on the next placement once the previous pick advanced to it, so a double click must not choose there too. */
const MIN_PICK_DELAY_AFTER_PLACEMENT_CHANGE_MS = 400;

const AWAITING_BIDS_COPY: Partial<Record<DeploymentFlowPhase, { title: string; description: string }>> = {
  creating: { title: "Creating your deployment", description: "Providers start bidding as soon as your deployment is on chain." },
  quoting: {
    title: "Waiting for bids",
    description: "The providers below can host this placement and are sending their bids. You can pick one as soon as its bid arrives."
  }
};

export const MarketplacePane: FC<Props> = ({
  sdl,
  placementName,
  region,
  phase,
  dseq,
  selectedPlacementId,
  selectedBidId,
  onSelectProvider,
  variant = "pane",
  chips,
  dependencies: d = DEPENDENCIES
}) => {
  const isExpanded = variant === "expanded";
  const { offers, isLoading, isError, isInvalid } = d.usePlacementOffers({ phase, dseq: dseq ?? undefined, sdl, placementName, region });
  const { query, setQuery, clear, filteredProviders, isSearchActive } = d.useProviderSearch(offers);
  const hasFailedWithoutData = isError && offers.length === 0;
  const isAwaitingFirstBid = offers.length > 0 && offers.every(offer => offer.offerState === "searching");
  const awaitingBids = isAwaitingFirstBid ? AWAITING_BIDS_COPY[phase] : undefined;
  const gpuCount = d.useDeploymentGpuCount(selectedPlacementId);
  const requestedCpuArch = d.useDeploymentCpuArch(selectedPlacementId);
  /** Provider names link out only once the user is onboarded: the route gate bounces a not-yet-onboarded user back into the funnel, so the link would dead-end. */
  const showProviderLink = d.useIsOnboarded();
  const { data: gpuVendors } = d.useGpuModels();
  const placementShownAt = useRef(Date.now());

  useEffect(
    function startOverOnAnotherPlacement() {
      placementShownAt.current = Date.now();
      if (isExpanded) clear();
    },
    [selectedPlacementId, isExpanded, clear]
  );

  const selectProvider = useCallback(
    (bidId: string) => {
      if (isExpanded && Date.now() - placementShownAt.current < MIN_PICK_DELAY_AFTER_PLACEMENT_CHANGE_MS) return;
      onSelectProvider(selectedPlacementId, bidId);
    },
    [isExpanded, onSelectProvider, selectedPlacementId]
  );

  return (
    <section aria-labelledby="configure-marketplace-pane-heading" className="flex h-full min-h-0 flex-col">
      <header className="flex h-[52px] shrink-0 items-center justify-between gap-4 border-b border-zinc-300 px-4 dark:border-zinc-700">
        <div className="flex min-w-0 items-center">
          <h2
            id="configure-marketplace-pane-heading"
            tabIndex={-1}
            className="shrink-0 font-mono text-sm font-medium uppercase text-muted-foreground outline-none"
          >
            {isExpanded ? "Compute Marketplace" : "3. Compute Marketplace"}
          </h2>
          <span className="ml-2 min-w-0 truncate font-mono text-sm font-semibold text-blue-500">• {placementName}</span>
        </div>
        <d.ProviderSearchInput value={query} onChange={setQuery} onClear={clear} />
      </header>
      {chips}
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
          <div className="flex flex-col gap-4">
            {awaitingBids && (
              <div role="status" className="flex items-start gap-3 rounded-lg border border-zinc-300 bg-muted/40 p-4 dark:border-zinc-700">
                <LoaderCircleIcon className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-primary" aria-hidden="true" />
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-semibold">{awaitingBids.title}</p>
                  <p className="text-sm text-muted-foreground">{awaitingBids.description}</p>
                </div>
              </div>
            )}
            <d.MarketplaceProvidersTable
              providers={filteredProviders}
              isBusy={!!awaitingBids}
              isLoading={isLoading}
              isSearchActive={isSearchActive}
              onClearSearch={clear}
              selectedBidId={selectedBidId}
              onSelect={selectProvider}
              isSelectable={phase === "quoting"}
              gpuCount={gpuCount}
              showProviderLink={showProviderLink}
              gpuVendors={gpuVendors}
              emptyMessage={requestedCpuArch ? `No ${requestedCpuArch} providers matched this configuration.` : undefined}
              selectOnRowClick={isExpanded}
            />
          </div>
        )}
      </div>
    </section>
  );
};
