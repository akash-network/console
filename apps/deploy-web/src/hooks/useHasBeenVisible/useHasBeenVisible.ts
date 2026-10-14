import { useCallback, useEffect, useState } from "react";

export const DEPENDENCIES = { IntersectionObserver: typeof window === "undefined" ? undefined : window.IntersectionObserver };

/** Whether the element the returned ref lands on has ever scrolled into view; without an observer to ask, it counts as seen. */
export function useHasBeenVisible<T extends Element>(dependencies: typeof DEPENDENCIES = DEPENDENCIES): [(element: T | null) => void, boolean] {
  const Observer = dependencies.IntersectionObserver;
  const [element, setElement] = useState<T | null>(null);
  const [hasBeenVisible, setHasBeenVisible] = useState(!Observer);

  useEffect(
    function watchUntilFirstSeen() {
      if (!Observer || !element || hasBeenVisible) return;

      const observer = new Observer(entries => {
        if (entries.some(entry => entry.isIntersecting)) setHasBeenVisible(true);
      });
      observer.observe(element);

      return function stopWatching() {
        observer.disconnect();
      };
    },
    [Observer, element, hasBeenVisible]
  );

  const ref = useCallback((next: T | null) => setElement(next), []);

  return [ref, hasBeenVisible];
}
