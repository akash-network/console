import { useEffect, useState } from "react";

export function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(
    function tickClock() {
      const interval = setInterval(() => setNow(Date.now()), intervalMs);

      return function stopClock() {
        clearInterval(interval);
      };
    },
    [intervalMs]
  );

  return now;
}
