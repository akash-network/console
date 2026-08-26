/**
 * A runtime limit is granted in increments: at most 48 hours up front, and at most 48 more per
 * extension. Mirrors `MAX_RUNTIME_LIMIT_INCREMENT_HOURS` in apps/api, which enforces it.
 */
export const MAX_RUNTIME_LIMIT_INCREMENT_HOURS = 48;

/** Ceiling on a runtime limit's total, reachable only by repeated extensions. Mirrors the API's cap. */
export const MAX_RUNTIME_LIMIT_HOURS = 8760;

/**
 * The runtime-limit tile's value: the requested hours, plus how long remains once the countdown is
 * anchored (it anchors when the lease starts, so a not-yet-leased deployment shows only the hours).
 *
 * The wall clock is read through the `now` parameter rather than `Date.now()` directly. That keeps the
 * output deterministic under fake timers in tests and lets callers stay fresh on pages that never refetch
 * by passing a ticking clock (`useTickingNow`) — without one, the "2h 10m left" / "limit reached" verdict
 * would freeze at first render.
 *
 * @param runtimeLimitHours The limit the user requested, shown as-is (e.g. "12h").
 * @param runtimeEndsAt When the deployment is closed automatically, ISO-encoded; null while the countdown
 * is unanchored, in which case only the limit itself is shown.
 * @param now The instant to measure remaining time against; defaults to the real present.
 */
export function formatRuntimeLimit(runtimeLimitHours: number, runtimeEndsAt: string | null, now: number = Date.now()): string {
  const limit = `${runtimeLimitHours}h`;
  if (!runtimeEndsAt) {
    return limit;
  }
  const millisecondsRemaining = new Date(runtimeEndsAt).getTime() - now;
  if (millisecondsRemaining <= 0) {
    return `${limit} · limit reached`;
  }
  return `${limit} · ${formatTimeRemaining(millisecondsRemaining)} left`;
}

const MILLISECONDS_PER_MINUTE = 60 * 1000;
const MINUTES_PER_HOUR = 60;

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
