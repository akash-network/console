"use client";
import type { FC } from "react";
import { useMemo, useState } from "react";
import { Badge, Button, CustomTooltip, Spinner, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { NavArrowDown, NavArrowUp, WarningCircle } from "iconoir-react";

import type { BidScreeningProvider } from "@src/hooks/useBidScreening";
import { getSplitText } from "@src/hooks/useShortText";
import type { ApiProviderList } from "@src/types/provider";
import { createFilterUnique } from "@src/utils/array";
import { roundDecimal } from "@src/utils/mathHelpers";
import { bytesToShrink } from "@src/utils/unitUtils";
import { AuditorButton } from "../../providers/AuditorButton";
import { Uptime } from "../../providers/Uptime";

export type EnrichedProvider = BidScreeningProvider & {
  name: string | null;
  location: string;
  countryCode: string;
  uptime7d: number;
  isAudited: boolean;
  gpuModels: { vendor: string; model: string }[];
  isFavorite: boolean;
  stats?: ApiProviderList["stats"];
  ipRegion?: string;
  ipRegionCode?: string;
  ipCountry?: string;
  ipCountryCode?: string;
  attributes?: ApiProviderList["attributes"];
};

type SortField = "leaseCount" | "uptime7d" | "availableCpu" | "availableGpu" | "availableMemory" | "name";
type SortDirection = "asc" | "desc";

type Props = {
  providers: EnrichedProvider[];
  isLoading: boolean;
  total: number;
  sortBy?: SortField;
  onGetQuote: (provider: EnrichedProvider) => void;
  onToggleFavorite: (owner: string) => void;
};

const PAGE_SIZES = [10, 25, 50];

const Unit: FC<{ value: number; unit: string }> = ({ value, unit }) => (
  <span>
    {value}
    {value > 0 && <small className="text-muted-foreground">{unit}</small>}
  </span>
);

export const ProviderTable: FC<Props> = ({ providers, isLoading, onGetQuote, onToggleFavorite, sortBy = "leaseCount" }) => {
  const [sortField, setSortField] = useState<SortField>(sortBy);
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  useMemo(() => {
    setSortField(sortBy);
    setPage(0);
  }, [sortBy]);

  const sorted = useMemo(() => {
    return [...providers].sort((a, b) => {
      if (sortField === "name") {
        const aName = (a.name ?? a.hostUri).toLowerCase();
        const bName = (b.name ?? b.hostUri).toLowerCase();
        return sortDir === "desc" ? bName.localeCompare(aName) : aName.localeCompare(bName);
      }
      const aVal = (a[sortField] as number) ?? 0;
      const bVal = (b[sortField] as number) ?? 0;
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });
  }, [providers, sortField, sortDir]);

  const paged = useMemo(() => sorted.slice(page * pageSize, (page + 1) * pageSize), [sorted, page, pageSize]);
  const pageCount = Math.ceil(sorted.length / pageSize);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIndicator: FC<{ field: SortField }> = ({ field }) => {
    if (sortField !== field) return null;
    return sortDir === "desc" ? <NavArrowDown className="ml-0.5 inline h-3 w-3" /> : <NavArrowUp className="ml-0.5 inline h-3 w-3" />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="medium" />
      </div>
    );
  }

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow className="[&>th:first-child]:pl-4 [&>th:last-child]:pr-4 [&>th]:whitespace-nowrap [&>th]:text-[11px]">
            <TableHead className="w-[14%]">Name</TableHead>
            <TableHead className="w-[8%] text-center">Location</TableHead>
            <TableHead className="w-[6%] cursor-pointer select-none text-center" onClick={() => toggleSort("uptime7d")}>
              Uptime (7d)
              <SortIndicator field="uptime7d" />
            </TableHead>
            <TableHead
              className={cn("w-[5%] cursor-pointer select-none text-center", { "font-bold text-primary": sortField === "leaseCount" })}
              onClick={() => toggleSort("leaseCount")}
            >
              Leases
              <SortIndicator field="leaseCount" />
            </TableHead>
            <TableHead
              className={cn("w-[8%] cursor-pointer select-none", { "font-bold text-primary": sortField === "availableGpu" })}
              onClick={() => toggleSort("availableGpu")}
            >
              GPU
              <SortIndicator field="availableGpu" />
            </TableHead>
            <TableHead className="w-[15%]">Resources</TableHead>
            <TableHead className="w-[5%] text-center">Audited</TableHead>
            <TableHead className="w-[10%]" />
          </TableRow>
        </TableHeader>

        <TableBody>
          {paged.map(provider => (
            <ProviderRow key={provider.owner} provider={provider} onGetQuote={onGetQuote} onToggleFavorite={onToggleFavorite} />
          ))}
          {paged.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                No providers match your current filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between border-t border-border px-4 py-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          Rows per page
          <select
            value={pageSize}
            onChange={e => {
              setPageSize(Number(e.target.value));
              setPage(0);
            }}
            className="rounded border border-border bg-background px-2 py-1 text-sm"
          >
            {PAGE_SIZES.map(size => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            Page {page + 1} of {Math.max(pageCount, 1)}
          </span>
          <Button variant="outline" size="xs" onClick={() => setPage(p => p - 1)} disabled={page === 0}>
            Previous
          </Button>
          <Button variant="outline" size="xs" onClick={() => setPage(p => p + 1)} disabled={page >= pageCount - 1}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
};

type RowProps = {
  provider: EnrichedProvider;
  onGetQuote: (provider: EnrichedProvider) => void;
};

const ProviderRow: FC<RowProps> = ({ provider, onGetQuote }) => {
  const stats = provider.stats;
  const activeCPU = stats ? stats.cpu.active / 1000 : 0;
  const pendingCPU = stats ? stats.cpu.pending / 1000 : 0;
  const totalCPU = stats ? (stats.cpu.available + stats.cpu.pending + stats.cpu.active) / 1000 : 0;
  const activeGPU = stats ? stats.gpu.active : 0;
  const pendingGPU = stats ? stats.gpu.pending : 0;
  const totalGPU = stats ? stats.gpu.available + stats.gpu.pending + stats.gpu.active : 0;
  const _activeMemory = stats ? bytesToShrink(stats.memory.active + stats.memory.pending) : null;
  const _totalMemory = stats ? bytesToShrink(stats.memory.available + stats.memory.pending + stats.memory.active) : null;
  const _activeStorage = stats
    ? bytesToShrink(stats.storage.ephemeral.active + stats.storage.ephemeral.pending + stats.storage.persistent.active + stats.storage.persistent.pending)
    : null;
  const _totalStorage = stats
    ? bytesToShrink(
        stats.storage.ephemeral.available +
          stats.storage.ephemeral.pending +
          stats.storage.ephemeral.active +
          stats.storage.persistent.available +
          stats.storage.persistent.pending +
          stats.storage.persistent.active
      )
    : null;
  const gpuModels = provider.gpuModels.map(x => x.model).filter(createFilterUnique());

  const displayName = provider.name ?? provider.hostUri.replace("https://", "");

  return (
    <TableRow className="cursor-pointer hover:bg-muted-foreground/10 [&>td:first-child]:pl-4 [&>td:last-child]:pr-4 [&>td]:px-2 [&>td]:py-1">
      <TableCell>
        {displayName.length > 20 ? (
          <CustomTooltip title={displayName}>
            <span className="text-xs">{getSplitText(displayName, 4, 13)}</span>
          </CustomTooltip>
        ) : (
          <span className="text-xs">{displayName}</span>
        )}
      </TableCell>
      <TableCell className="text-center">
        {provider.ipRegion && provider.ipCountry ? (
          <CustomTooltip
            title={
              <>
                {provider.ipRegion}, {provider.ipCountry}
              </>
            }
          >
            <div className="text-xs">
              {provider.ipRegionCode}, {provider.ipCountryCode}
            </div>
          </CustomTooltip>
        ) : (
          <span className="text-xs">{provider.countryCode || provider.location}</span>
        )}
      </TableCell>
      <TableCell className="text-center font-bold">
        <Uptime value={provider.uptime7d} />
      </TableCell>
      <TableCell className="text-center">{provider.leaseCount}</TableCell>
      <TableCell>
        {stats ? (
          totalGPU > 0 ? (
            <div className="space-y-1">
              <span className="whitespace-nowrap text-xs">
                {Math.round(activeGPU + pendingGPU)}
                <small className="text-muted-foreground">/{Math.round(totalGPU)}</small>
              </span>
              {gpuModels.length > 0 && (
                <div className="flex flex-wrap gap-0.5">
                  {gpuModels.map(gpu => (
                    <Badge key={gpu} variant="outline" className="px-1 py-0 text-[10px] leading-tight">
                      {gpu}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )
        ) : null}
      </TableCell>
      <TableCell>
        {stats ? (
          <div className="grid grid-cols-[auto_1fr] gap-x-2 text-xs leading-tight">
            <span className="text-muted-foreground">CPU</span>
            <span className="whitespace-nowrap">
              {Math.round(activeCPU + pendingCPU)}
              <small className="text-muted-foreground">/{Math.round(totalCPU)}</small>
            </span>
            <span className="text-muted-foreground">Mem</span>
            <span className="whitespace-nowrap">
              {_activeMemory && _totalMemory ? (
                <>
                  <Unit value={roundDecimal(_activeMemory.value, 0)} unit={_activeMemory.unit} />
                  <small className="text-muted-foreground">
                    /<Unit value={roundDecimal(_totalMemory.value, 0)} unit={_totalMemory.unit} />
                  </small>
                </>
              ) : null}
            </span>
            <span className="text-muted-foreground">Disk</span>
            <span className="whitespace-nowrap">
              {_activeStorage && _totalStorage ? (
                <>
                  <Unit value={roundDecimal(_activeStorage.value, 0)} unit={_activeStorage.unit} />
                  <small className="text-muted-foreground">
                    /<Unit value={roundDecimal(_totalStorage.value, 0)} unit={_totalStorage.unit} />
                  </small>
                </>
              ) : null}
            </span>
          </div>
        ) : null}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-center">
          {provider.isAudited ? (
            <>
              <span className="text-xs">Yes</span>
              {provider.attributes && <AuditorButton provider={provider as any} />}
            </>
          ) : (
            <>
              <span className="text-xs text-muted-foreground">No</span>
              <WarningCircle className="ml-2 text-xs text-warning" />
            </>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Button variant="outline" size="xs" onClick={() => onGetQuote(provider)} className="whitespace-nowrap">
          Get a quote →
        </Button>
      </TableCell>
    </TableRow>
  );
};
