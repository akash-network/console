"use client";
import * as React from "react";
import { Badge, CustomTooltip } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Info } from "lucide-react";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { useTrialDeploymentTimeRemaining } from "@src/hooks/useTrialDeploymentTimeRemaining";
import { TrialDeploymentTooltip } from "./TrialDeploymentTooltip";

export type Props = {
  createdHeight?: number;
  trialDurationHours?: number;
  averageBlockTime?: number;
  className?: string;
  dependencies?: typeof DEPENDENCIES;
};

export const DEPENDENCIES = {
  Badge,
  CustomTooltip,
  TrialDeploymentTooltip,
  useTrialTimeRemaining: useTrialDeploymentTimeRemaining
};

export function TrialDeploymentBadge({ createdHeight, trialDurationHours, averageBlockTime = 6, className, dependencies: d = DEPENDENCIES }: Props) {
  const trialDuration = trialDurationHours ?? browserEnvConfig.NEXT_PUBLIC_TRIAL_DEPLOYMENTS_DURATION_HOURS;

  const { isExpired, timeRemainingText } = d.useTrialTimeRemaining({
    createdHeight,
    trialDurationHours: trialDuration,
    averageBlockTime
  });

  return (
    <d.CustomTooltip
      title={
        <d.TrialDeploymentTooltip createdHeight={createdHeight} isExpired={isExpired} timeRemainingText={timeRemainingText} trialDuration={trialDuration} />
      }
      className="p-6"
    >
      <div className="inline-flex items-center gap-1">
        <d.Badge variant={isExpired ? "destructive" : "default"} className={cn("inline-flex cursor-help items-center gap-1", className)}>
          <span>Trial</span>
          <Info className="h-3 w-3" />
        </d.Badge>
      </div>
    </d.CustomTooltip>
  );
}
