/**
 * A runtime limit is granted in increments: at most 48 hours up front, and at most 48 more per
 * extension. Mirrors `MAX_RUNTIME_LIMIT_INCREMENT_HOURS` in apps/api, which enforces it.
 */
export const MAX_RUNTIME_LIMIT_INCREMENT_HOURS = 48;

/** Ceiling on a runtime limit's total, reachable only by repeated extensions. Mirrors the API's cap. */
export const MAX_RUNTIME_LIMIT_HOURS = 8760;

export type RuntimeLimitStatus = "unanchored" | "running" | "reached";

export type RuntimeLimitCountdown = {
  status: RuntimeLimitStatus;
  limitLabel: string;
  remainingLabel: string;
  /** Names what the remaining time is measured against, e.g. "of 12h limit". */
  captionLabel: string;
  /** Spells out both quantities for screen readers, e.g. "2h 10m of 12h left". */
  accessibleLabel: string;
  percentRemaining: number;
};

const MILLISECONDS_PER_MINUTE = 60 * 1000;
const MINUTES_PER_HOUR = 60;
const MILLISECONDS_PER_HOUR = MINUTES_PER_HOUR * MILLISECONDS_PER_MINUTE;

/** The remaining share is measured against the granted limit itself, since no lease-start timestamp is stored. */
export function getRuntimeLimitCountdown(runtimeLimitHours: number, runtimeEndsAt: string | null, now: number = Date.now()): RuntimeLimitCountdown {
  const limitLabel = `${runtimeLimitHours}h`;
  const deadline = runtimeEndsAt ? new Date(runtimeEndsAt).getTime() : NaN;

  if (!Number.isFinite(deadline)) {
    return {
      status: "unanchored",
      limitLabel,
      remainingLabel: limitLabel,
      captionLabel: "runtime limit",
      accessibleLabel: `${limitLabel} limit, not started`,
      percentRemaining: 100
    };
  }

  const millisecondsRemaining = deadline - now;

  if (millisecondsRemaining <= 0) {
    return {
      status: "reached",
      limitLabel,
      remainingLabel: "Limit reached",
      captionLabel: `${limitLabel} limit`,
      accessibleLabel: `${limitLabel} limit reached`,
      percentRemaining: 0
    };
  }

  const remainingLabel = formatTimeRemaining(millisecondsRemaining);

  return {
    status: "running",
    limitLabel,
    remainingLabel: `${remainingLabel} left`,
    captionLabel: `of ${limitLabel} limit`,
    accessibleLabel: `${remainingLabel} of ${limitLabel} left`,
    percentRemaining: toPercentRemaining(millisecondsRemaining, runtimeLimitHours)
  };
}

/**
 * The remaining time as the coarsest honest reading: minutes alone below an hour, hours alone on the hour,
 * both otherwise. Rounding up at the minute keeps the final seconds reading "1m" rather than "0m", and never
 * overstates by more than a minute — unlike rounding up whole hours, which sold 2h10m as "~3h".
 */
function formatTimeRemaining(milliseconds: number): string {
  const totalMinutes = Math.ceil(milliseconds / MILLISECONDS_PER_MINUTE);
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const minutes = totalMinutes % MINUTES_PER_HOUR;

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/** Clamped to 1-100 so a limit still counting down never reads as empty and a deadline beyond the limit never overflows the track. */
function toPercentRemaining(millisecondsRemaining: number, runtimeLimitHours: number): number {
  const limitMilliseconds = runtimeLimitHours * MILLISECONDS_PER_HOUR;
  if (limitMilliseconds <= 0) return 100;
  return Math.min(100, Math.max(1, Math.round((millisecondsRemaining / limitMilliseconds) * 100)));
}
