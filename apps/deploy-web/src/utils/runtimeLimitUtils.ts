/**
 * A runtime limit is granted in increments: at most 48 hours up front, and at most 48 more per
 * extension. Mirrors `MAX_RUNTIME_LIMIT_INCREMENT_HOURS` in apps/api, which enforces it.
 */
export const MAX_RUNTIME_LIMIT_INCREMENT_HOURS = 48;

/** Ceiling on a runtime limit's total, reachable only by repeated extensions. Mirrors the API's cap. */
export const MAX_RUNTIME_LIMIT_HOURS = 8760;

export type RuntimeLimitStatus = "unanchored" | "running" | "reached";

export type RuntimeLimitCountdown = {
  /** `unanchored` until the lease starts and the deadline exists; `reached` once it has passed. */
  status: RuntimeLimitStatus;
  /** The granted total, e.g. "12h". */
  limitLabel: string;
  /** How much of the limit is left, e.g. "2h 10m left"; the total alone while unanchored. */
  remainingLabel: string;
  /** What the remaining time is measured against, phrased to sit under it, e.g. "of 12h limit". */
  captionLabel: string;
  /** Both quantities spelled out for screen readers, e.g. "2h 10m of 12h left". */
  accessibleLabel: string;
  /** Share of the limit still unspent, 0-100, for the meter. */
  percentRemaining: number;
};

const MILLISECONDS_PER_MINUTE = 60 * 1000;
const MINUTES_PER_HOUR = 60;
const MILLISECONDS_PER_HOUR = MINUTES_PER_HOUR * MILLISECONDS_PER_MINUTE;

/**
 * What the deployment detail page shows for a runtime limit: the remaining time, the granted total, and the
 * share of the total still unspent. The two quantities are kept apart on purpose — rendered as one string
 * ("1h · 36m left") a total and a remainder read as a single duration.
 *
 * The share is derived rather than measured: no start timestamp is stored, so the denominator is the granted
 * limit itself and the implied start is `runtimeEndsAt - runtimeLimitHours`. Adding hours moves both
 * endpoints together, so the meter refills by exactly what was bought. The labels stay exact regardless.
 *
 * The wall clock is read through the `now` parameter rather than `Date.now()` directly. That keeps the output
 * deterministic in tests and lets callers stay fresh on pages that never refetch by passing a ticking clock
 * (`useTickingNow`) — without one, the countdown would freeze at first render.
 *
 * @param runtimeLimitHours The limit the user requested, shown as-is (e.g. "12h").
 * @param runtimeEndsAt When the deployment is closed automatically, ISO-encoded; null while the countdown is
 * unanchored, in which case only the limit itself can be shown.
 * @param now The instant to measure remaining time against; defaults to the real present.
 */
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

/**
 * Floored at one percent so a bar whose label still claims "1m left" never reads as empty, and capped at a
 * hundred so a deadline further out than the limit — a limit shortened after the fact, or clock skew — cannot
 * overflow the track.
 */
function toPercentRemaining(millisecondsRemaining: number, runtimeLimitHours: number): number {
  const limitMilliseconds = runtimeLimitHours * MILLISECONDS_PER_HOUR;
  if (limitMilliseconds <= 0) return 100;
  return Math.min(100, Math.max(1, Math.round((millisecondsRemaining / limitMilliseconds) * 100)));
}
