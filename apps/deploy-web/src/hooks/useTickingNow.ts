import { useEffect, useState } from "react";

/** Wall-clock labels typically show whole minutes or hours, so re-rendering once a minute keeps them honest without per-second churn. */
export const DEFAULT_TICK_INTERVAL_MS = 60_000;

/**
 * Re-renders on a fixed cadence while `enabled`, so wall-clock-derived labels stay current on pages that never
 * refetch (no polling, refetch-on-focus disabled). Returns the time of the latest tick.
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
