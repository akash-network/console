import { setTimeout as delay } from "node:timers/promises";

import { latestValue, type Signal } from "../latest-value/latest-value";

/**
 * Wraps a source async iterable, eagerly draining it into a {@link latestValue} cell and re-emitting
 * the freshest value at most once per `intervalMs`.
 *
 * Two loops cooperate through the cell: a producer drains the source as fast as it arrives (keeping
 * only the newest value, so a fast producer can never build a backlog), and the consumer emits the
 * current value and then holds off until the interval elapses. Intermediate values produced during
 * that window are dropped — only the latest survives. Emission is leading + trailing: the first value
 * is yielded immediately, subsequent values no sooner than `intervalMs` apart, and a value still
 * pending when the source ends is flushed before completing. Source errors are propagated after the
 * in-flight value; an aborted `signal` ends iteration promptly.
 */
export async function* throttleLatest<T>(source: AsyncIterable<T>, intervalMs: number, options: { signal?: AbortSignal } = {}): AsyncGenerator<T> {
  const { signal } = options;
  const latest = latestValue<T>({ signal });

  pump(source, latest).catch(() => undefined);

  for await (const value of latest) {
    yield value;
    await delay(intervalMs, undefined, { signal }).catch(() => undefined);
    if (signal?.aborted) return;
  }
}

async function pump<T>(source: AsyncIterable<T>, latest: Signal<T>): Promise<void> {
  try {
    for await (const value of source) latest.set(value);
    latest.close();
  } catch (error) {
    latest.fail(error);
  }
}
