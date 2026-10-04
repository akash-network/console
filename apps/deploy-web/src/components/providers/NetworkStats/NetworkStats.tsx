import type { FC } from "react";
import { Skeleton } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";

import type { NetworkStats as NetworkStatsData } from "@src/components/providers/ProvidersExplorer/useProvidersExplorerModel";
import { formatCompactCount, formatUptime } from "@src/components/providers/providerSummary/providerSummary";

type Props = {
  stats: NetworkStatsData;
  layout: "column" | "row";
  className?: string;
};

export const NetworkStats: FC<Props> = ({ stats, layout, className }) => (
  <dl className={cn("gap-[7px]", layout === "column" ? "flex flex-col" : "grid grid-cols-3", className)}>
    <StatTile
      label="GPUs available"
      value={stats.availableGpuCount === null ? null : stats.availableGpuCount.toLocaleString("en-US")}
      foot={
        stats.activeProviderCount === null || stats.availableVcpuCount === null
          ? null
          : `${stats.activeProviderCount} providers · ${formatCompactCount(stats.availableVcpuCount)} vCPU free`
      }
      delayMs={0}
    />
    <StatTile
      label="Avg uptime (30d)"
      value={stats.averageUptime30d === null ? null : formatUptime(stats.averageUptime30d)}
      foot="Online providers, rolling 30 days"
      delayMs={70}
    />
    <StatTile
      label="Running now"
      value={stats.activeLeaseCount === null ? null : stats.activeLeaseCount.toLocaleString("en-US")}
      foot="Active leases"
      delayMs={140}
    />
  </dl>
);

type StatTileProps = {
  label: string;
  value: string | null;
  foot: string | null;
  delayMs: number;
};

const StatTile: FC<StatTileProps> = ({ label, value, foot, delayMs }) => (
  <div
    className="min-w-0 rounded-[11px] border border-border bg-card/80 px-3 py-2 backdrop-blur-md duration-500 animate-in fade-in-0 slide-in-from-left-2 fill-mode-both motion-reduce:animate-none"
    style={{ animationDelay: `${delayMs}ms` }}
  >
    <dt className="text-[9.5px] font-semibold uppercase leading-tight tracking-[0.1em] text-muted-foreground">{label}</dt>
    <dd className="mt-[3px] text-[21px] font-semibold leading-none tracking-[-0.02em] text-foreground">
      {value ?? <Skeleton className="h-[21px] w-16" aria-label={`Loading ${label.toLowerCase()}`} />}
    </dd>
    {foot && <dd className="mt-0.5 line-clamp-2 text-[10.5px] leading-[1.35] text-muted-foreground">{foot}</dd>}
  </div>
);
