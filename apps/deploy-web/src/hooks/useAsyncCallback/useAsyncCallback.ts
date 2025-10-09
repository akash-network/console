import { useCallback, useState } from "react";

export function useAsyncCallback<T extends (...args: unknown[]) => Promise<unknown>>(fn: T, deps: unknown[] = []): UseAsyncCallbackResult<T> {
  const [data, setData] = useState<ReturnType<T> | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isPending, setIsPending] = useState(false);

  const invoke = useCallback(
    (...args: Parameters<T>) => {
      if (isPending) return;
      setIsPending(true);
      return fn(...args)
        .then(result => {
          setData(result as ReturnType<T>);
          return result;
        })
        .catch(setError)
        .finally(() => setIsPending(false));
    },
    [fn, isPending, ...deps]
  ) as T;

  return [invoke, { data, error, isPending }];
}

export type UseAsyncCallbackResult<T extends (...args: unknown[]) => Promise<unknown>> = [
  T,
  { data: ReturnType<T> | null; error: Error | null; isPending: boolean }
];
