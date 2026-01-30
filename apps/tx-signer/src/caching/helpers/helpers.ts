export function memoizeAsync<T extends (...args: unknown[]) => Promise<unknown>>(fn: T): T {
  const cache = new Map<string, ReturnType<T>>();

  return ((...args: Parameters<T>) => {
    const key = JSON.stringify(args);

    const cached = cache.get(key);
    if (cached) {
      return cached;
    }

    const promise = fn(...args) as ReturnType<T>;

    promise.catch(() => {
      cache.delete(key);
    });

    cache.set(key, promise);
    return promise;
  }) as unknown as T;
}
