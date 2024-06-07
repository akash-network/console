import { useEffect } from "react";

export function useWhen<T>(condition: T, run: () => void, deps: unknown[] = []): void {
  return useEffect(() => {
    if (condition) {
      run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condition, ...deps]);
}
