/**
 * Memoizes an async function so that it is called at most once.
 * On success the resolved value is cached permanently.
 * On rejection the cache is cleared so the next call retries.
 */
export function memoizeAsync<T>(fn: () => Promise<T>): () => Promise<T> {
  let cached: Promise<T> | undefined;

  return () => {
    if (cached) {
      return cached;
    }

    cached = fn();
    cached.catch(() => {
      cached = undefined;
    });

    return cached;
  };
}
