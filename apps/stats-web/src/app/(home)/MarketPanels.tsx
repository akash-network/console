"use client";
import { toCapacityRows, toGpuRows, toGpuSummary } from "./dashboardModel";

import { Link } from "@/components/Link/Link";
import { DeltaLabel, Eyebrow, LoadError, MeterBar, Panel, PanelTitle } from "@/components/stats/Panel";
import { Sparkline } from "@/components/stats/Sparkline";
import type { SeriesPoint } from "@/lib/series/series";
import { deltaPercent, sliceRange } from "@/lib/series/series";
import { formatNumber } from "@/lib/statsFormat/statsFormat";
import { UrlService } from "@/lib/urlUtils";
import { cn } from "@/lib/utils";
import type { GpuModelPrice, NetworkCapacity } from "@/types";
import { SnapshotsUrlParam } from "@/types";

const GPU_TABLE_ROW_LIMIT = 8;
const GPU_TABLE_COLUMNS = "grid grid-cols-[1.2fr_0.6fr_1.4fr_0.6fr_0.6fr_0.6fr] gap-2.5";

export function KpiCard({ label, value, series, href }: { label: string; value: string; series: SeriesPoint[] | undefined; href: string }) {
  return (
    <Link
      href={href}
      className="group flex min-w-0 flex-col gap-2.5 rounded-lg border bg-card px-5 py-[18px] text-foreground transition-colors hover:border-border-strong hover:text-foreground hover:no-underline"
    >
      <Eyebrow>{label}</Eyebrow>
      <div className="flex items-end justify-between gap-2">
        <span className="text-[26px] font-semibold tabular-nums leading-none tracking-[-0.02em]">{value}</span>
        <Sparkline series={series && sliceRange(series, 30)} />
      </div>
      <DeltaLabel percent={series && deltaPercent(series, 30)} period="30D" />
      {!series && <span className="h-[11px]" />}
    </Link>
  );
}

export function GpuMarketplacePanel({
  models,
  capacity,
  loadError,
  className
}: {
  models: GpuModelPrice[] | undefined;
  capacity: NetworkCapacity | undefined;
  loadError?: { onRetry: () => void };
  className?: string;
}) {
  const rows = models ? toGpuRows(models, GPU_TABLE_ROW_LIMIT) : [];

  return (
    <Panel className={cn("flex flex-col gap-1 px-5 py-5 sm:px-6", className)}>
      <div className="flex items-baseline justify-between gap-3 pb-3">
        <div className="flex min-w-0 items-baseline gap-3">
          <PanelTitle>GPU marketplace</PanelTitle>
          {capacity && <span className="truncate font-mono text-[11px] uppercase text-faint">{toGpuSummary(capacity)}</span>}
        </div>
        <Link
          href={UrlService.graph(SnapshotsUrlParam.graphics)}
          className="whitespace-nowrap text-xs font-medium text-muted-foreground hover:text-akash hover:no-underline"
        >
          GPU trend →
        </Link>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          <div className={cn(GPU_TABLE_COLUMNS, "border-b pb-2 font-mono text-[10px] font-medium uppercase leading-none tracking-[0.1em] text-faint")}>
            <span>Model</span>
            <span>VRAM</span>
            <span>Available</span>
            <span className="text-right">Min/hr</span>
            <span className="text-right">Avg/hr</span>
            <span className="text-right">Max/hr</span>
          </div>

          {!models && loadError && <LoadError subject="GPU prices" onRetry={loadError.onRetry} />}
          {!models && !loadError && Array.from({ length: 6 }, (_, index) => <div key={index} className="my-2 h-5 animate-pulse rounded bg-nested" />)}

          {rows.map(row => (
            <div key={row.key} className={cn(GPU_TABLE_COLUMNS, "items-center border-b border-muted py-[9px] font-mono text-xs leading-none")}>
              <span className="font-medium uppercase tracking-[0.02em]">{row.model}</span>
              <span className="text-[11px] text-muted-foreground">{row.ram}</span>
              <div className="flex items-center gap-2">
                <MeterBar percent={row.availablePercent} className="h-1 flex-1" fillClassName={row.isScarce ? "bg-foreground" : "bg-muted-foreground"} />
                <span className="min-w-[64px] text-right text-[11px] text-muted-foreground">{row.availability}</span>
              </div>
              <span className="text-right text-muted-foreground">{row.minPrice}</span>
              <span className="text-right font-medium">{row.averagePrice}</span>
              <span className="text-right text-muted-foreground">{row.maxPrice}</span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

export function CapacityPanel({ capacity, className }: { capacity: NetworkCapacity | undefined; className?: string }) {
  return (
    <Panel className={cn("flex flex-col px-[22px] py-5", className)}>
      <div className="flex items-baseline justify-between gap-3 pb-3.5">
        <PanelTitle>Capacity</PanelTitle>
        <span className="font-mono text-[11px] uppercase text-faint">{formatNumber(capacity?.activeProviderCount)} active providers</span>
      </div>

      {capacity &&
        toCapacityRows(capacity).map(row => (
          <div key={row.label} className="flex flex-col gap-[7px] border-b border-muted py-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <Eyebrow className="text-muted-foreground">{row.label}</Eyebrow>
              <span className="whitespace-nowrap font-mono text-[11px] text-faint">
                <span className="font-medium text-foreground">{row.active}</span> / {row.total}
              </span>
            </div>
            <MeterBar percent={row.percent} fillClassName={row.label === "GPU" ? "bg-foreground" : "bg-muted-foreground"} />
          </div>
        ))}

      <p className="pt-3 text-[11px] leading-relaxed text-faint">Leased now vs. total network capacity. Providers compete for what&apos;s idle.</p>
    </Panel>
  );
}
