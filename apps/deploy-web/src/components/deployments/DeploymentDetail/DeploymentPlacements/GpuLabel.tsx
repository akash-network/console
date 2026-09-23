"use client";
import type { FC } from "react";
import { Fragment } from "react";
import { CustomNoDivTooltip, Skeleton } from "@akashnetwork/ui/components";

import { describeGpus, type DetectedGpuSummary, formatGpuLabel, NO_GPU_LABEL } from "./placementModel";

/** CustomNoDivTooltip, so the truncating span stays the trigger rather than a wrapper around it. */
export const DEPENDENCIES = {
  CustomTooltip: CustomNoDivTooltip
};

export interface GpuLabelProps {
  gpuAmount: number;
  models: string[];
  detected?: DetectedGpuSummary[];
  isLoading?: boolean;
  dependencies?: typeof DEPENDENCIES;
}

export const GpuLabel: FC<GpuLabelProps> = ({ gpuAmount, models, detected, isLoading = false, dependencies: d = DEPENDENCIES }) => {
  const gpus = describeGpus(gpuAmount, models, detected);

  if (!gpus.length) return <>{NO_GPU_LABEL}</>;

  if (isLoading) {
    return (
      <span className="inline-flex items-center gap-1.5">
        {`${gpuAmount}×`}
        <Skeleton className="inline-block h-3 w-16" data-testid="gpu-model-skeleton" />
      </span>
    );
  }

  return (
    <d.CustomTooltip title={formatGpuLabel(gpuAmount, models, detected)} className="p-3">
      <span className="block max-w-44 truncate" tabIndex={0}>
        {gpus.map(({ count, model }, index) => (
          <Fragment key={`${model}-${index}`}>
            {index > 0 && ", "}
            {model ? `${count}× ` : count}
            {model && <span className="text-xs font-normal text-muted-foreground">{model}</span>}
          </Fragment>
        ))}
      </span>
    </d.CustomTooltip>
  );
};
