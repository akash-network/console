import { useEffect, useRef, useState } from "react";

/**
 * Animates a progress bar between phase markers.
 *
 * Each phase owns the segment between its start marker and the next marker. While the phase
 * is still being worked on, the bar eases toward — but never reaches — the next marker, so a
 * stalled bar reads as "still working". When the phase finishes, the bar snaps forward to that
 * phase's marker (covering the case where the work finished before the creep caught up), then
 * begins easing toward the following marker. The cycle repeats per phase.
 *
 * The easing is asymptotic (exponential approach to a ceiling just short of the next marker),
 * so it decelerates as it nears the ceiling and never "completes" a phase on its own.
 */

type UsePhasedProgressBarInput = {
  /** Ascending marker positions (0–100). `markers[i]` is where phase `i` *ends*. */
  markers: ReadonlyArray<number>;
  /**
   * Index of the phase currently being worked on, or `markers.length` once every phase is
   * complete (drives the bar to 100). `error` flows are expected to unmount the bar instead.
   */
  activeIndex: number;
  /**
   * Per-phase time constant in ms — roughly how long that phase typically takes. Larger means
   * a slower creep toward the ceiling. Indexed by phase; falls back to `defaultTimeConstant`.
   */
  timeConstants?: ReadonlyArray<number>;
  /**
   * Fraction (0–1) of the gap to the next marker the creep is allowed to cover while the phase
   * is still active. 0.95 → it stalls 5% short of the marker until the phase actually completes.
   */
  ceilingFraction?: number;
  defaultTimeConstant?: number;
  /**
   * Changing this snaps the bar back to 0 and restarts the creep — used when the flow is
   * retried/started over so the bar doesn't stay parked at its previous (monotonic) high.
   */
  resetKey?: unknown;
};

const DEFAULT_TIME_CONSTANT = 6000;
const DEFAULT_CEILING_FRACTION = 0.95;
/** Upper bound of the progress bar (100%). */
const BAR_MAX = 100;
/** Once we're in the all-done phase, anything within this much of `BAR_MAX` snaps to 100 so the bar lands exactly on the end. */
const SNAP_THRESHOLD = 99.5;

export function usePhasedProgressBar({
  markers,
  activeIndex,
  timeConstants,
  ceilingFraction = DEFAULT_CEILING_FRACTION,
  defaultTimeConstant = DEFAULT_TIME_CONSTANT,
  resetKey
}: UsePhasedProgressBarInput): number {
  const [percent, setPercent] = useState(0);

  /** Mirror props into a ref so the rAF loop reads the latest values without re-subscribing. */
  const inputRef = useRef({ markers, activeIndex, timeConstants, ceilingFraction, defaultTimeConstant });
  inputRef.current = { markers, activeIndex, timeConstants, ceilingFraction, defaultTimeConstant };

  const valueRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const tickRef = useRef<((time: DOMHighResTimeStamp) => void) | null>(null);

  const didMountRef = useRef(false);
  /**
   * Snaps the bar back to 0 when `resetKey` changes (e.g. on retry/start-over) so the next
   * creep starts from scratch instead of staying parked at the previous monotonic high.
   * The mount-skip guard avoids a redundant reset on the very first render. If the rAF loop
   * has already stopped (we reached 100), re-kicks it so the bar can animate from 0 again.
   */
  useEffect(
    function resetProgressOnRetry() {
      if (!didMountRef.current) {
        didMountRef.current = true;
        return;
      }
      valueRef.current = 0;
      lastTimeRef.current = null;
      setPercent(0);
      if (frameRef.current === null && tickRef.current) {
        frameRef.current = requestAnimationFrame(tickRef.current);
      }
    },
    [resetKey]
  );

  /**
   * Drives the bar with a `requestAnimationFrame` loop. Each frame reads the latest
   * `inputRef.current` (markers / activeIndex / time constants), so external phase transitions
   * take effect immediately without restarting the loop. The loop stops once the bar lands on
   * 100 in the all-done phase; `resetProgressOnRetry` re-kicks it when `resetKey` changes.
   */
  useEffect(function startProgressBarLoop() {
    /**
     * One animation frame: computes the next bar position using exponential easing toward
     * the current phase's ceiling (or 100 when every phase is complete) and re-queues itself
     * unless the bar has reached its terminal 100 value.
     */
    function tick(time: DOMHighResTimeStamp) {
      const { markers, activeIndex, timeConstants, ceilingFraction, defaultTimeConstant } = inputRef.current;

      if (lastTimeRef.current === null) lastTimeRef.current = time;
      const elapsedMs = time - lastTimeRef.current;
      lastTimeRef.current = time;

      const { allDone, phaseStart, nextMarker } = getPhaseBounds(markers, activeIndex);
      const current = valueRef.current;
      const floor = Math.max(current, phaseStart);
      const ceiling = allDone ? BAR_MAX : phaseStart + (nextMarker - phaseStart) * ceilingFraction;
      const timeConstantMs = timeConstants?.[Math.min(activeIndex, markers.length - 1)] ?? defaultTimeConstant;

      const eased = easeToward({ floor, ceiling, elapsedMs, timeConstantMs });
      const next = allDone && eased > SNAP_THRESHOLD ? BAR_MAX : eased;

      if (next !== current) {
        valueRef.current = next;
        setPercent(next);
      }

      if (allDone && next === BAR_MAX) {
        frameRef.current = null;
        lastTimeRef.current = null;
        return;
      }
      frameRef.current = requestAnimationFrame(tick);
    }

    tickRef.current = tick;
    frameRef.current = requestAnimationFrame(tick);

    return function cancelProgressBarLoop() {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      lastTimeRef.current = null;
      tickRef.current = null;
    };
  }, []);

  return percent;
}

/** Resolve where the current phase's bar segment starts and ends (or 100 once every phase is done). */
function getPhaseBounds(markers: ReadonlyArray<number>, activeIndex: number) {
  const allDone = activeIndex >= markers.length;
  const phaseStart = activeIndex <= 0 ? 0 : markers[activeIndex - 1] ?? 0;
  const nextMarker = allDone ? BAR_MAX : markers[activeIndex] ?? BAR_MAX;
  return { allDone, phaseStart, nextMarker };
}

/**
 * Exponential ease-toward step: returns where the bar should land this frame, given how far it
 * still has to travel and how much time has passed. The fraction-covered-this-frame formula
 * `1 - exp(-dt / tc)` decelerates the closer we get, so the bar never overshoots the ceiling.
 */
function easeToward({ floor, ceiling, elapsedMs, timeConstantMs }: { floor: number; ceiling: number; elapsedMs: number; timeConstantMs: number }) {
  const gapCoveredThisFrame = 1 - Math.exp(-elapsedMs / Math.max(timeConstantMs, 1));
  const target = floor + (ceiling - floor) * gapCoveredThisFrame;
  return Math.min(BAR_MAX, Math.max(floor, target));
}
