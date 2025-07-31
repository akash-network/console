import { formatDistanceToNow } from "date-fns";

export interface TimeRemainingResult {
  timeLeft: Date | null;
  isExpired: boolean;
  blocksRemaining: number;
}

/**
 * Calculates the time remaining for a trial deployment based on block heights
 */
export function calculateTrialTimeRemaining(
  createdHeight: number,
  currentHeight: number,
  trialDurationHours: number,
  averageBlockTime: number
): TimeRemainingResult {
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
export function formatTrialTimeRemaining(timeLeft: Date | null, isExpired: boolean): string {
  if (isExpired) {
    return "Trial expired";
  }

  if (!timeLeft) {
    return "Calculating...";
  }

  return formatDistanceToNow(timeLeft, { addSuffix: true });
}

/**
 * Calculates blocks per hour based on average block time
 */
export function calculateBlocksPerHour(averageBlockTime: number): number {
  return (60 * 60) / averageBlockTime;
}

/**
 * Calculates total trial blocks based on duration and block time
 */
export function calculateTotalTrialBlocks(trialDurationHours: number, averageBlockTime: number): number {
  return trialDurationHours * calculateBlocksPerHour(averageBlockTime);
}
