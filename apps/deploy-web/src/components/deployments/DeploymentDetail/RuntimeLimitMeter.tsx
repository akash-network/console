"use client";
import type { FC } from "react";
import { Progress } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";

import type { RuntimeLimitCountdown } from "@src/utils/runtimeLimitUtils";

export interface RuntimeLimitMeterProps {
  countdown: RuntimeLimitCountdown;
  className?: string;
}

/** Renders nothing while the countdown is unanchored, where a full bar would claim elapsed time the lease has not started spending. */
export const RuntimeLimitMeter: FC<RuntimeLimitMeterProps> = ({ countdown, className }) => {
  if (countdown.status === "unanchored") return null;

  return (
    <Progress
      value={countdown.percentRemaining}
      getValueLabel={() => countdown.accessibleLabel}
      aria-label={`Runtime remaining: ${countdown.accessibleLabel}`}
      className={cn("h-1", className)}
    />
  );
};
