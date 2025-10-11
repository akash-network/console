import { useCallback, useState } from "react";

export function useAsyncCallback<T extends (...args: unknown[]) => Promise<unknown>>(fn: T, deps: unknown[] = []): UseAsyncCallbackResult<T> {
  const [data, setData] = useState<ReturnType<T> | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [inflightPromise, setInflightPromise] = useState<Promise<unknown> | null>(null);

  const invoke = useCallback(
    (...args: Parameters<T>) => {
      if (inflightPromise) return inflightPromise;
      const promise = fn(...args)
        .then(result => {
          setData(result as ReturnType<T>);
          return result;
        })
        .catch(setError)
        .finally(() => setInflightPromise(null));
      setInflightPromise(promise);
      return promise;
    },
    [fn, inflightPromise, ...deps]
  ) as T;

  return [invoke, { data, error, isPending: !!inflightPromise }];
}

export type UseAsyncCallbackResult<T extends (...args: unknown[]) => Promise<unknown>> = [
  T,
  { data: ReturnType<T> | null; error: Error | null; isPending: boolean }
];
