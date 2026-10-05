"use client";
import type { FC, MouseEvent, ReactNode } from "react";
import { Button, Skeleton } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { ChevronLeft, ChevronRight, RefreshCw, Star } from "lucide-react";

import { PAGE_SIZE } from "@src/components/providers/ProvidersExplorer/useProvidersExplorerModel";
import type { ProviderSummary, UptimeQuality } from "@src/components/providers/providerSummary/providerSummary";
import { formatBytes, formatGpuModel, formatUptime, getUptimeQuality } from "@src/components/providers/providerSummary/providerSummary";
import { RegionPill } from "@src/components/providers/RegionPill/RegionPill";

const UPTIME_TONE_CLASSES: Record<UptimeQuality, string> = {
  excellent: "text-emerald-600 dark:text-emerald-400",
  healthy: "text-sky-600 dark:text-sky-400",
  variable: "text-amber-600 dark:text-amber-500"
};

type Props = {
  providers: ProviderSummary[];
  status: "loading" | "failed" | "ready";
  matchingProviderCount: number;
  pageIndex: number;
  pageCount: number;
  onPageChange: (pageIndex: number) => void;
  selectedOwner: string | null;
  onSelect: (provider: ProviderSummary) => void;
  favoriteProviders: string[];
  onToggleFavorite: (owner: string) => void;
  onRetry: () => void;
  isCompact: boolean;
  regionFilter: ReactNode;
  gpuFilter: ReactNode;
};

export const ProvidersTable: FC<Props> = ({
  providers,
  status,
  matchingProviderCount,
  pageIndex,
  pageCount,
  onPageChange,
  selectedOwner,
  onSelect,
  favoriteProviders,
  onToggleFavorite,
  onRetry,
  isCompact,
  regionFilter,
  gpuFilter
}) => (
  <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
    {status === "failed" && (
      <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
        <p role="alert" className="text-[13px] text-muted-foreground">
          Couldn&apos;t load providers.
        </p>
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Retry
        </Button>
      </div>
    )}

    {status !== "failed" && (
      <table className="w-full table-fixed border-collapse" aria-label="Providers" aria-busy={status === "loading"}>
        {isCompact ? (
          <colgroup>
            <col />
            <col className="w-[76px]" />
          </colgroup>
        ) : (
          <colgroup>
            <col />
            <col className="w-[15%]" />
            <col className="w-[13%]" />
            <col className="w-[8%]" />
            <col className="w-[15%]" />
            <col className="w-[12%]" />
            <col className="w-[76px]" />
          </colgroup>
        )}
        <thead className={cn(isCompact && "sr-only")}>
          <tr className="border-b bg-muted">
            <HeaderCell>Provider</HeaderCell>
            {!isCompact && (
              <>
                <HeaderCell hasFilter>{regionFilter}</HeaderCell>
                <HeaderCell hasFilter>{gpuFilter}</HeaderCell>
                <HeaderCell>GPUs</HeaderCell>
                <HeaderCell>Capacity</HeaderCell>
                <HeaderCell>Uptime (30d)</HeaderCell>
              </>
            )}
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {status === "loading" && providers.length === 0 && <SkeletonRows columnCount={isCompact ? 2 : 7} />}
          {status === "ready" && providers.length === 0 && (
            <tr>
              <td colSpan={isCompact ? 2 : 7} className="px-5 py-10 text-center text-[13px] text-muted-foreground">
                No providers match those filters.
              </td>
            </tr>
          )}
          {providers.map(provider => (
            <ProviderRow
              key={provider.owner}
              provider={provider}
              isSelected={provider.owner === selectedOwner}
              isFavorite={favoriteProviders.includes(provider.owner)}
              isCompact={isCompact}
              onSelect={onSelect}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </tbody>
      </table>
    )}

    {status !== "failed" && matchingProviderCount > PAGE_SIZE && (
      <nav aria-label="Providers pages" className="flex items-center gap-2.5 border-t bg-muted px-3.5 py-2">
        <span className="font-mono text-[11px] text-muted-foreground">
          {pageIndex * PAGE_SIZE + 1}–{Math.min(matchingProviderCount, (pageIndex + 1) * PAGE_SIZE)} of {matchingProviderCount}
        </span>
        <span className="flex-1" />
        <Button variant="outline" size="sm" className="h-7 gap-1 px-2.5 text-xs" disabled={pageIndex === 0} onClick={() => onPageChange(pageIndex - 1)}>
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
          Previous
        </Button>
        <span className="font-mono text-[11.5px] text-foreground">
          {pageIndex + 1} / {pageCount}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 px-2.5 text-xs"
          disabled={pageIndex >= pageCount - 1}
          onClick={() => onPageChange(pageIndex + 1)}
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </nav>
    )}
  </div>
);

const HeaderCell: FC<{ hasFilter?: boolean; children: ReactNode }> = ({ hasFilter, children }) => (
  <th
    scope="col"
    className={cn(
      "whitespace-nowrap text-left font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground",
      hasFilter ? "px-2 py-[5px]" : "px-3.5 py-2.5"
    )}
  >
    {children}
  </th>
);

type ProviderRowProps = {
  provider: ProviderSummary;
  isSelected: boolean;
  isFavorite: boolean;
  isCompact: boolean;
  onSelect: (provider: ProviderSummary) => void;
  onToggleFavorite: (owner: string) => void;
};

const ProviderRow: FC<ProviderRowProps> = ({ provider, isSelected, isFavorite, isCompact, onSelect, onToggleFavorite }) => {
  const selectProvider = () => onSelect(provider);
  const toggleFavorite = (event: MouseEvent) => {
    event.stopPropagation();
    onToggleFavorite(provider.owner);
  };

  return (
    <tr
      onClick={selectProvider}
      data-selected={isSelected}
      className="h-[58px] cursor-pointer border-t transition-colors first:border-t-0 data-[selected=true]:bg-muted hover:bg-muted"
    >
      <td className="min-w-0 px-3.5 py-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-1.5">
            <button
              type="button"
              onClick={event => {
                event.stopPropagation();
                selectProvider();
              }}
              className="truncate text-left text-[13.5px] font-semibold text-foreground hover:underline"
            >
              {provider.name}
            </button>
            {!provider.isOnline && (
              <span className="shrink-0 rounded-full bg-warning/15 px-1.5 py-px font-mono text-[10px] font-medium text-warning">Offline</span>
            )}
          </span>
          <span className="truncate font-mono text-[10.5px] text-muted-foreground" title={provider.owner}>
            {provider.owner}
          </span>
          {isCompact && <CompactSummary provider={provider} />}
        </div>
      </td>
      {!isCompact && (
        <>
          <td className="px-3.5 py-3">{provider.locationRegion ? <RegionPill region={provider.locationRegion} /> : <EmptyValue />}</td>
          <td className="px-3.5 py-3">
            <GpuModels models={provider.gpuModels} />
          </td>
          <td className="px-3.5 py-3 font-mono text-[12.5px] text-foreground">{provider.gpuCount > 0 ? provider.gpuCount : <EmptyValue />}</td>
          <td className="truncate px-3.5 py-3 font-mono text-[11.5px] text-muted-foreground">
            {provider.vcpuCount} vCPU · {formatBytes(provider.memoryBytes)}
          </td>
          <td className="px-3.5 py-3 font-mono text-[12.5px]">
            <Uptime uptime={provider.uptime30d} />
          </td>
        </>
      )}
      <td className="px-2 py-1.5 text-right">
        <span className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={toggleFavorite}
            aria-label={isFavorite ? `Remove ${provider.name} from favorites` : `Add ${provider.name} to favorites`}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          >
            <Star className={cn("h-3.5 w-3.5", isFavorite && "fill-amber-400 text-amber-400")} aria-hidden />
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        </span>
      </td>
    </tr>
  );
};

const CompactSummary: FC<{ provider: ProviderSummary }> = ({ provider }) => (
  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
    {provider.locationRegion && <RegionPill region={provider.locationRegion} />}
    <span className="font-mono text-[10.5px] text-muted-foreground">{describeCompactGpus(provider)}</span>
    <span className="font-mono text-[10.5px]">
      <Uptime uptime={provider.uptime30d} />
    </span>
  </div>
);

const GpuModels: FC<{ models: string[] }> = ({ models }) => {
  if (models.length === 0) return <span className="font-mono text-[11px] text-muted-foreground">CPU only</span>;

  const [first, ...rest] = models;
  return (
    <span className="inline-flex min-w-0 items-center gap-1" title={models.map(formatGpuModel).join(", ")}>
      <span className="truncate rounded-full border bg-muted px-2 py-0.5 font-mono text-[10.5px] text-foreground">{formatGpuModel(first)}</span>
      {rest.length > 0 && <span className="font-mono text-[10.5px] text-muted-foreground">+{rest.length}</span>}
    </span>
  );
};

const Uptime: FC<{ uptime: number | null }> = ({ uptime }) => {
  if (uptime === null) return <EmptyValue />;

  return (
    <span className={cn("inline-flex items-center gap-1.5", UPTIME_TONE_CLASSES[getUptimeQuality(uptime)])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {formatUptime(uptime)}
    </span>
  );
};

const EmptyValue: FC = () => (
  <span className="text-muted-foreground" aria-label="None">
    —
  </span>
);

const SkeletonRows: FC<{ columnCount: number }> = ({ columnCount }) => (
  <>
    {Array.from({ length: 4 }).map((_, rowIndex) => (
      <tr key={rowIndex} className="h-[58px] border-t first:border-t-0">
        {Array.from({ length: columnCount }).map((__, columnIndex) => (
          <td key={columnIndex} className="px-3.5 py-3">
            <Skeleton className={cn("h-3", columnIndex === 0 ? "w-40" : "w-14")} />
          </td>
        ))}
      </tr>
    ))}
  </>
);

function describeCompactGpus({ gpuCount, gpuModels }: ProviderSummary): string {
  if (gpuCount === 0) return "CPU only";
  const [firstModel, ...otherModels] = gpuModels;
  const model = firstModel ? formatGpuModel(firstModel) : "GPU";
  return otherModels.length > 0 ? `${gpuCount}× ${model} +${otherModels.length}` : `${gpuCount}× ${model}`;
}
