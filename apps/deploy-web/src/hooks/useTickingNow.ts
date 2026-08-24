import { useEffect, useState } from "react";

/**
 * Default cadence between re-renders.
 *
 * Labels built on this hook typically display whole minutes ("2m left") or whole hours ("~5h left"), so one
 * update per minute keeps them honest — including flipping to an expired state within a minute of crossing
 * the deadline — while avoiding the per-second churn a visibly-running countdown like `useQuoteExpiry` needs.
 */
export const DEFAULT_TICK_INTERVAL_MS = 60_000;

/**
 * Re-renders the calling component on a fixed cadence so wall-clock-derived output cannot go stale.
 *
 * Some views compute text from `Date.now()` at render time but never refetch data — no query polling and
 * refetch-on-focus disabled — so once mounted, that text freezes at whatever was true on first render until
 * an unrelated re-render happens. A user who leaves such a page open keeps seeing a stale verdict long after
 * reality moved on (e.g. "~1h left" after the deadline already passed). This hook fixes that: while
 * `enabled`, an interval pushes `Date.now()` into state every `intervalMs`, re-rendering the component so
 * anything formatted from the returned clock stays current.
 *
 * Behavior:
 * - While disabled there is no interval and no re-renders; the returned time holds at the last value (the
 *   mount-time clock, or the final tick before disabling) — safe, because disabled means nothing on screen
 *   depends on the clock.
 * - The effect re-subscribes whenever `enabled` or `intervalMs` changes and always clears its interval on
 *   unmount, so switching deadlines or navigating away never leaks a timer.
 * - Ticks land on interval boundaries relative to subscription, not wall-clock minutes; exact alignment does
 *   not matter since consumers round (ceil/floor) when formatting.
 *
 * @example
 * const now = useTickingNow(!!runtimeEndsAt);
 * return <span>{formatTimeLeft(runtimeEndsAt, now)}</span>;
 *
 * @param enabled Whether anything rendered depends on the current time — typically "a deadline exists".
 * Pass false rather than mounting always-on so idle pages pay no timer cost.
 * @param intervalMs Milliseconds between ticks. Match it to the display's granularity: a label showing
 * whole hours needs minute ticks at most, while second-level countdowns should pass something smaller.
 * @returns The clock backing the latest render: `Date.now()` at mount, refreshed at every tick.
 */
export function useTickingNow(enabled: boolean, intervalMs = DEFAULT_TICK_INTERVAL_MS): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(
    function tickWhileEnabled() {
      if (!enabled) return;
      const interval = setInterval(function advanceNow() {
        setNow(Date.now());
      }, intervalMs);
      return function stopTicking() {
        clearInterval(interval);
      };
    },
    [enabled, intervalMs]
  );

  return now;
}
