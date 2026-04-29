export interface InProgressBandBounds {
  left: number;
  width: number;
}

interface ComputeInProgressBandInput {
  todayX: number;
  previousX: number;
  plotAreaWidth: number;
}

export function computeInProgressBand({ todayX, previousX, plotAreaWidth }: ComputeInProgressBandInput): InProgressBandBounds {
  const halfDayWidth = (todayX - previousX) / 2;
  const rawLeft = todayX - halfDayWidth;
  const rawRight = todayX + halfDayWidth;
  const clampedLeft = Math.max(0, Math.min(rawLeft, plotAreaWidth));
  const clampedRight = Math.max(clampedLeft, Math.min(rawRight, plotAreaWidth));
  return { left: clampedLeft, width: clampedRight - clampedLeft };
}
