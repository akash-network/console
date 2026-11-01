import * as React from "react";
import { formatDistanceToNow } from "date-fns";

import { useLatestBlockHeight } from "@src/hooks/useLatestBlockHeight/useLatestBlockHeight";

export interface TimeRemainingResult {
  timeLeft: Date | null;
  isExpired: boolean;
  blocksRemaining: number;
}

export type UseTrialDeploymentTimeRemainingProps = {
  createdHeight?: number;
  trialDurationHours?: number;
  averageBlockTime?: number;
  dependencies?: typeof DEPENDENCIES;
};

export const DEPENDENCIES = {
  useLatestBlockHeight
};

/**
 * Calculates the time remaining for a trial deployment based on block heights
 */
function calculateTrialTimeRemaining(createdHeight: number, currentHeight: number, trialDurationHours: number, averageBlockTime: number): TimeRemainingResult {
  const blocksPerHour = (60 * 60) / averageBlockTime;
  const totalTrialBlocks = trialDurationHours * blocksPerHour;
  const blocksElapsed = currentHeight - createdHeight;
  const blocksRemaining = totalTrialBlocks - blocksElapsed;

  if (blocksRemaining <= 0) {
    return {
      timeLeft: null,
      isExpired: true,
      blocksRemaining: 0
    };
  }

  const secondsRemaining = blocksRemaining * averageBlockTime;
  const timeLeft = new Date(Date.now() + secondsRemaining * 1000);

  return {
    timeLeft,
    isExpired: false,
    blocksRemaining: Math.floor(blocksRemaining)
  };
}

/**
 * Formats the time remaining in a human-readable format
 */
function formatTrialTimeRemaining(timeLeft: Date | null, isExpired: boolean): string {
  if (isExpired) {
    return "Trial expired";
  }

  if (!timeLeft) {
    return "Calculating...";
  }

  return formatDistanceToNow(timeLeft, { addSuffix: true });
}

export function useTrialDeploymentTimeRemaining({
  createdHeight,
  trialDurationHours,
  averageBlockTime = 6,
  dependencies: d = DEPENDENCIES
}: UseTrialDeploymentTimeRemainingProps) {
  const latestBlockHeight = d.useLatestBlockHeight();

  const { timeLeft, isExpired } = React.useMemo(() => {
    if (latestBlockHeight === undefined || !createdHeight || !trialDurationHours) {
      return { timeLeft: null, isExpired: false };
    }

    const result = calculateTrialTimeRemaining(createdHeight, latestBlockHeight, trialDurationHours, averageBlockTime);
    return { timeLeft: result.timeLeft, isExpired: result.isExpired };
  }, [createdHeight, latestBlockHeight, trialDurationHours, averageBlockTime]);

  const timeRemainingText = React.useMemo(() => {
    if (!createdHeight) return null;
    return formatTrialTimeRemaining(timeLeft, isExpired);
  }, [timeLeft, isExpired, createdHeight]);

  return { timeLeft, isExpired, timeRemainingText };
}
