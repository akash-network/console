"use client";
import type { FC } from "react";
import { Progress } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";

import type { RuntimeLimitCountdown } from "@src/utils/runtimeLimitUtils";

export interface RuntimeLimitMeterProps {
  countdown: RuntimeLimitCountdown;
  className?: string;
}

/** Renders nothing unless time is actually draining: a bar on a lease that never started, or has stopped, claims runtime that is not being spent. */
export const RuntimeLimitMeter: FC<RuntimeLimitMeterProps> = ({ countdown, className }) => {
  if (countdown.status === "unanchored" || countdown.status === "ended") return null;

  return (
    <Progress
      value={countdown.percentRemaining}
      getValueLabel={() => countdown.accessibleLabel}
      aria-label={`Runtime remaining: ${countdown.accessibleLabel}`}
      className={cn("h-1", className)}
    />
  );
};
