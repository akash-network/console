import { performance } from "node:perf_hooks";
import { setImmediate } from "node:timers/promises";

type Matcher<T> = (a: T, b: T) => boolean;

export function createFilterUnique<T>(matcher: Matcher<T> = (a, b) => a === b): (value: T, index: number, array: T[]) => boolean {
  return (value, index, array) => {
    return array.findIndex(other => matcher(value, other)) === index;
  };
}

export async function forEachInChunks<T>(
  items: T[],
  fn: (item: T, index: number) => unknown,
  options?: {
    /**
     * Maximum time spent per chunk in milliseconds.
     * @default 5ms
     */
    maxTimeSpentPerChunk?: number;
    /**
     * Decides when to schedule the next chunk for processing if `maxTimeSpentPerChunk` was reached.
     */
    scheduleNextChunk?: () => Promise<void>;
  }
): Promise<void> {
  let i = 0;
  const maxTimeSpentPerChunk = options?.maxTimeSpentPerChunk ?? 5;
  const scheduleNextChunk = options?.scheduleNextChunk ?? setImmediate;

  while (i < items.length) {
    const start = performance.now();

    while (i < items.length && performance.now() - start < maxTimeSpentPerChunk) {
      fn(items[i], i);
      i++;
    }

    if (i < items.length) {
      await scheduleNextChunk();
    }
  }
}
