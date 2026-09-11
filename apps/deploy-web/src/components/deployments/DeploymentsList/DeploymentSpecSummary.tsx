"use client";
import type { FC, ReactNode } from "react";
import { MdDeveloperBoard, MdMemory, MdSpeed, MdStorage } from "react-icons/md";
import { cn } from "@akashnetwork/ui/utils";

import type { DeploymentDto } from "@src/types/deployment";
import { roundDecimal } from "@src/utils/mathHelpers";
import { formatByteSize } from "@src/utils/unitUtils";
import { formatGpuLabel, getDeploymentGpuModels } from "../DeploymentDetail/DeploymentPlacements/placementModel";

export interface DeploymentSpecSummaryProps {
  deployment: Pick<DeploymentDto, "cpuAmount" | "gpuAmount" | "memoryAmount" | "storageAmount" | "groups">;
  className?: string;
}

export const DeploymentSpecSummary: FC<DeploymentSpecSummaryProps> = ({ deployment, className }) => {
  const hasGpu = !!deployment.gpuAmount;

  return (
    <div className={cn("flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground", className)}>
      {hasGpu && <Spec label="GPU" icon={<MdDeveloperBoard />} value={formatGpuLabel(deployment.gpuAmount ?? 0, getDeploymentGpuModels(deployment.groups))} />}
      <Spec label="vCPU" icon={<MdSpeed />} value={roundDecimal(deployment.cpuAmount, 2)} />
      <Spec label="Memory" icon={<MdMemory />} value={formatByteSize(deployment.memoryAmount)} />
      <Spec label="Storage" icon={<MdStorage />} value={formatByteSize(deployment.storageAmount)} />
    </div>
  );
};

const Spec: FC<{ label: string; icon: ReactNode; value: ReactNode }> = ({ label, icon, value }) => (
  <span className="inline-flex items-center gap-1.5 whitespace-nowrap" title={label}>
    <span className="text-base" aria-hidden="true">
      {icon}
    </span>
    <span aria-label={label}>{value}</span>
  </span>
);
