"use client";
import type { FC } from "react";
import { Progress } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";

import type { RuntimeLimitCountdown } from "@src/utils/runtimeLimitUtils";

export interface RuntimeLimitMeterProps {
  countdown: RuntimeLimitCountdown;
  className?: string;
}

/**
 * The remaining share of a runtime limit as a slim bar: the track is the limit the user bought and the fill is
 * what is left of it, so the two quantities read as container and portion instead of as two durations.
 *
 * Renders nothing until the countdown is anchored — a deployment whose lease has not started has no elapsed
 * time to show, and a full bar would claim otherwise. That decision lives here so no caller repeats it.
 */
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
