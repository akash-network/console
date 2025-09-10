import { type DependencyList, useEffect, useRef } from "react";

export function useThrottledEffect(effect: () => void | (() => void), deps: DependencyList, delay = 100) {
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleanup = useRef<void | (() => void)>();

  useEffect(() => {
    if (timeout.current) {
      clearTimeout(timeout.current);
    }

    timeout.current = setTimeout(() => {
      if (typeof cleanup.current === "function") {
        cleanup.current();
        cleanup.current = undefined;
      }
      cleanup.current = effect();
      timeout.current = null;
    }, delay);

    return () => {
      if (timeout.current) {
        clearTimeout(timeout.current);
        timeout.current = null;
      }
      if (typeof cleanup.current === "function") {
        cleanup.current();
        cleanup.current = undefined;
      }
    };
  }, deps);
}
