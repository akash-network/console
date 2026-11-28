export type MemoizeAsyncOptions = { maxEntries?: number };

export function memoizeAsync<Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
  options?: MemoizeAsyncOptions
): (...args: Args) => Promise<Result> {
  const cache = new Map<string, Promise<Result>>();
  const maxEntries = options?.maxEntries ?? Infinity;

  return (...args: Args) => {
    const key = JSON.stringify(args);

    const cached = cache.get(key);
    if (cached) {
      return cached;
    }

    const promise = fn(...args);

    promise.catch(() => {
      cache.delete(key);
    });

    if (cache.size >= maxEntries) {
      const [oldestKey] = cache.keys();
      cache.delete(oldestKey);
    }

    cache.set(key, promise);
    return promise;
  };
}
