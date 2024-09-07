import { useEffect } from "react";

export function useWhenNot<T>(condition: T, run: () => void, deps: unknown[] = [], ifNot: () => void): void {
  return useEffect(() => {
    if (condition) {
      run();
    } else {
      if (ifNot) ifNot();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condition, ...deps]);
}
