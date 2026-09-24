import type { FC, ReactNode } from "react";
import { cn } from "@akashnetwork/ui/utils";

import type { LeaseDto } from "@src/types/deployment";
import { roundDecimal } from "@src/utils/mathHelpers";
import { formatByteSize } from "@src/utils/unitUtils";
import { GpuLabel, type GpuLabelProps } from "./GpuLabel";

export interface PlacementStat {
  label: string;
  value: ReactNode;
}

export const PlacementStats: FC<{ stats: PlacementStat[]; variant?: "compact" | "spread" }> = ({ stats, variant = "compact" }) => (
  <div className={cn("flex flex-wrap", variant === "spread" ? "w-full gap-10" : "justify-start gap-8 lg:justify-end")}>
    {stats.map(stat => (
      <div key={stat.label} className={cn("flex min-w-0 flex-col gap-1", variant === "spread" && "flex-1")}>
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{stat.label}</span>
        <span className="whitespace-nowrap text-base font-semibold">{stat.value}</span>
      </div>
    ))}
  </div>
);

export function buildPlacementStats(lease: LeaseDto, serviceCount: number, gpu: Omit<GpuLabelProps, "gpuAmount">): PlacementStat[] {
  const stats: PlacementStat[] = [
    { label: "vCPU", value: roundDecimal(lease.cpuAmount, 2) },
    { label: "Memory", value: formatByteSize(lease.memoryAmount) },
    { label: "Storage", value: formatByteSize(lease.storageAmount) }
  ];
  if (lease.gpuAmount && lease.gpuAmount > 0) {
    stats.push({ label: "GPU", value: <GpuLabel gpuAmount={lease.gpuAmount} {...gpu} /> });
  }
  stats.push({ label: "Services", value: serviceCount });
  return stats;
}
