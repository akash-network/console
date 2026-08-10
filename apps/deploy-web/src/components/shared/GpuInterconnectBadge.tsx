"use client";
import * as React from "react";
import { Badge, CustomTooltip } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Info, Waypoints } from "lucide-react";

import type { DeclaredGpuInterconnect } from "@src/utils/gpuInterconnect";
import { formatGpuInterconnectFabricLabel } from "@src/utils/gpuInterconnect";

export type Props = {
  interconnect: DeclaredGpuInterconnect;
  /** Icon-forward chip for the narrow list-row name cell; the full label lives in the tooltip. */
  compact?: boolean;
  className?: string;
  dependencies?: typeof DEPENDENCIES;
};

export const DEPENDENCIES = {
  Badge,
  CustomTooltip
};

function getFullLabel(fabrics: string[]): string {
  return fabrics.length === 1 ? `GPU Interconnect (${formatGpuInterconnectFabricLabel(fabrics[0])})` : "GPU Interconnect";
}

function getFabricSummary(fabrics: string[]): string {
  if (fabrics.length === 0) return "Fabric: chosen by the provider.";
  const labels = fabrics.map(formatGpuInterconnectFabricLabel).join(", ");
  return fabrics.length === 1 ? `Fabric: ${labels}.` : `Fabrics: ${labels}.`;
}

export function GpuInterconnectBadge({ interconnect, compact = false, className, dependencies: d = DEPENDENCIES }: Props) {
  if (!interconnect.enabled) return null;

  const fullLabel = getFullLabel(interconnect.fabrics);

  return (
    <d.CustomTooltip
      title={
        <div className="max-w-xs space-y-2 text-sm">
          {compact && <p>{fullLabel}</p>}
          <p>
            One or more services in this deployment use GPU interconnect — high-bandwidth, low-latency RDMA between nodes (over InfiniBand or RoCE) for
            distributed GPU workloads such as multi-node NCCL training.
          </p>
          <p>{getFabricSummary(interconnect.fabrics)}</p>
        </div>
      }
    >
      <div className="inline-flex items-center gap-1">
        <d.Badge variant="secondary" className={cn("inline-flex cursor-help items-center gap-1", className)}>
          {compact ? (
            <>
              <Waypoints className="h-3 w-3" />
              <span>Interconnect</span>
            </>
          ) : (
            <>
              <span>{fullLabel}</span>
              <Info className="h-3 w-3" />
            </>
          )}
        </d.Badge>
      </div>
    </d.CustomTooltip>
  );
}
