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
 * by passing a ticking clock (`useTickingNow`) — without one, the "~Xh left" / "reached" verdict would
 * freeze at first render.
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
  const hoursRemaining = (new Date(runtimeEndsAt).getTime() - now) / (1000 * 60 * 60);
  if (hoursRemaining <= 0) {
    return `${limit} · reached`;
  }
  return `${limit} · ~${Math.ceil(hoursRemaining)}h left`;
}
