"use client";
import type { FC, ReactNode } from "react";
import { MdDeveloperBoard, MdMemory, MdSpeed, MdStorage } from "react-icons/md";
import { CustomNoDivTooltip } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";

import type { DeploymentDto } from "@src/types/deployment";
import { roundDecimal } from "@src/utils/mathHelpers";
import { formatByteSize } from "@src/utils/unitUtils";
import { formatGpuLabel, getDeploymentGpuModels } from "../DeploymentDetail/DeploymentPlacements/placementModel";

/** Column widths fit the widest value each spec can hold at this font size, so every row's specs land on the same x-positions. */
const LAYOUT_CLASSES = {
  inline: { container: "flex flex-wrap items-center gap-x-4 gap-y-1.5", spec: "whitespace-nowrap" },
  columns: { container: "grid grid-cols-[3.5rem_5.5rem_5.5rem_5.75rem] items-center gap-x-3", spec: "min-w-0" }
} as const;

export type DeploymentSpecLayout = keyof typeof LAYOUT_CLASSES;

/** CustomNoDivTooltip, so the trigger stays the grid item and keeps the truncation the columns layout needs. */
export const DEPENDENCIES = {
  CustomTooltip: CustomNoDivTooltip
};

export interface DeploymentSpecSummaryProps {
  deployment: Pick<DeploymentDto, "cpuAmount" | "gpuAmount" | "memoryAmount" | "storageAmount" | "groups">;
  layout?: DeploymentSpecLayout;
  className?: string;
  dependencies?: typeof DEPENDENCIES;
}

export const DeploymentSpecSummary: FC<DeploymentSpecSummaryProps> = ({ deployment, layout = "inline", className, dependencies: d = DEPENDENCIES }) => {
  const hasGpu = !!deployment.gpuAmount;
  const layoutClasses = LAYOUT_CLASSES[layout];

  return (
    <div className={cn("text-xs text-muted-foreground", layoutClasses.container, className)}>
      <Spec label="vCPU" icon={<MdSpeed />} value={roundDecimal(deployment.cpuAmount, 2)} className={layoutClasses.spec} dependencies={d} />
      <Spec label="Memory" icon={<MdMemory />} value={formatByteSize(deployment.memoryAmount)} className={layoutClasses.spec} dependencies={d} />
      <Spec label="Storage" icon={<MdStorage />} value={formatByteSize(deployment.storageAmount)} className={layoutClasses.spec} dependencies={d} />
      {hasGpu && (
        <Spec
          label="GPU"
          icon={<MdDeveloperBoard />}
          value={formatGpuLabel(deployment.gpuAmount ?? 0, getDeploymentGpuModels(deployment.groups))}
          className={layoutClasses.spec}
          dependencies={d}
        />
      )}
    </div>
  );
};

/** The columns layout truncates the value, and a long GPU model list is otherwise unrecoverable. */
const Spec: FC<{ label: string; icon: ReactNode; value: string | number; className?: string; dependencies: typeof DEPENDENCIES }> = ({
  label,
  icon,
  value,
  className,
  dependencies: d
}) => (
  <d.CustomTooltip title={`${label}: ${value}`} className="p-3">
    <span className={cn("inline-flex cursor-help items-center gap-1.5", className)}>
      <span className="shrink-0 text-sm" aria-hidden="true">
        {icon}
      </span>
      <span className="truncate" aria-label={label}>
        {value}
      </span>
    </span>
  </d.CustomTooltip>
);
