import { useEffect, useMemo, useState } from "react";
import debounce from "lodash/debounce";

interface PacingOptions {
  /** Quiet period after the last change before the value is committed. */
  wait: number;
  /** Hard ceiling so a never-settling stream of changes still commits at least this often. */
  maxWait: number;
}

/**
 * Returns a paced copy of `value`: the first value is committed immediately, and every later change
 * is debounced by `wait` with a `maxWait` ceiling. Pass a referentially-stable `value` (e.g. a memoized
 * object) so renders that don't change it don't reschedule the commit. Pacing the value that drives a
 * query key is how an expensive endpoint is shielded from per-keystroke requests.
 */
export function usePacedValue<T>(value: T, { wait, maxWait }: PacingOptions): T {
  const [paced, setPaced] = useState(value);
  const commit = useMemo(() => debounce(setPaced, wait, { maxWait }), [wait, maxWait]);

  useEffect(
    function paceValue() {
      commit(value);
    },
    [commit, value]
  );

  useEffect(
    function cancelPendingOnUnmount() {
      return function cancelPending() {
        commit.cancel();
      };
    },
    [commit]
  );

  return paced;
}
