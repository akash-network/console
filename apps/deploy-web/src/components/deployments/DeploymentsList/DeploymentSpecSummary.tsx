"use client";
import type { FC, ReactNode } from "react";
import { MdDeveloperBoard, MdMemory, MdSpeed, MdStorage } from "react-icons/md";
import { cn } from "@akashnetwork/ui/utils";

import type { DeploymentDto } from "@src/types/deployment";
import { roundDecimal } from "@src/utils/mathHelpers";
import { formatByteSize } from "@src/utils/unitUtils";
import { formatGpuLabel, getDeploymentGpuModels } from "../DeploymentDetail/DeploymentPlacements/placementModel";

/** Column widths fit the widest value each spec can hold at this font size, so every row's specs land on the same x-positions. */
const LAYOUT_CLASSES = {
  inline: "flex flex-wrap items-center gap-x-4 gap-y-1.5",
  columns: "grid grid-cols-[3.5rem_5.5rem_5.5rem_5.75rem] items-center gap-x-3"
} as const;

export type DeploymentSpecLayout = keyof typeof LAYOUT_CLASSES;

export interface DeploymentSpecSummaryProps {
  deployment: Pick<DeploymentDto, "cpuAmount" | "gpuAmount" | "memoryAmount" | "storageAmount" | "groups">;
  layout?: DeploymentSpecLayout;
  className?: string;
}

export const DeploymentSpecSummary: FC<DeploymentSpecSummaryProps> = ({ deployment, layout = "inline", className }) => {
  const hasGpu = !!deployment.gpuAmount;
  const isAlignedInColumns = layout === "columns";
  const specClassName = isAlignedInColumns ? "min-w-0" : "whitespace-nowrap";

  return (
    <div className={cn("text-xs text-muted-foreground", LAYOUT_CLASSES[layout], className)}>
      <Spec label="vCPU" icon={<MdSpeed />} value={roundDecimal(deployment.cpuAmount, 2)} className={specClassName} />
      <Spec label="Memory" icon={<MdMemory />} value={formatByteSize(deployment.memoryAmount)} className={specClassName} />
      <Spec label="Storage" icon={<MdStorage />} value={formatByteSize(deployment.storageAmount)} className={specClassName} />
      {hasGpu && (
        <Spec
          label="GPU"
          icon={<MdDeveloperBoard />}
          value={formatGpuLabel(deployment.gpuAmount ?? 0, getDeploymentGpuModels(deployment.groups))}
          className={specClassName}
        />
      )}
    </div>
  );
};

const Spec: FC<{ label: string; icon: ReactNode; value: ReactNode; className?: string }> = ({ label, icon, value, className }) => (
  <span className={cn("inline-flex items-center gap-1.5", className)} title={label}>
    <span className="shrink-0 text-sm" aria-hidden="true">
      {icon}
    </span>
    <span className="truncate" aria-label={label}>
      {value}
    </span>
  </span>
);
