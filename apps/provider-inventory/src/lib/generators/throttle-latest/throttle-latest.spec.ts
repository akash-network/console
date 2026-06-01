import { setTimeout as delay } from "node:timers/promises";
import { describe, expect, it } from "vitest";

import { throttleLatest } from "./throttle-latest";

const INTERVAL = 50;
// Comfortably shorter than INTERVAL: long enough for microtasks/leading emits to settle,
// short enough to assert "nothing emitted yet" before the interval boundary.
const SETTLE = 10;

describe("throttleLatest", () => {
  it("emits the first value immediately without waiting for the interval", async () => {
    const { stream, push } = createPushStream<number>();
    const collected = collect(stream);

    push(1);
    await delay(SETTLE);

    expect(collected.values).toEqual([1]);
  });

  it("drops intermediate values and emits only the latest once the interval elapses", async () => {
    const { stream, push } = createPushStream<number>();
    const collected = collect(stream);

    push(1);
    await delay(SETTLE);
    expect(collected.values).toEqual([1]);

    push(2);
    push(3);
    await delay(INTERVAL / 2);
    expect(collected.values).toEqual([1]);

    await delay(INTERVAL);
    expect(collected.values).toEqual([1, 3]);
  });

  it("emits every value when they arrive slower than the interval", async () => {
    const { stream, push } = createPushStream<number>();
    const collected = collect(stream);

    push(1);
    await delay(SETTLE);
    expect(collected.values).toEqual([1]);

    await delay(INTERVAL);
    push(2);
    await delay(SETTLE);
    expect(collected.values).toEqual([1, 2]);
  });

  it("flushes the final pending value when the source ends mid-interval", async () => {
    const { stream, push, end } = createPushStream<number>();
    const collected = collect(stream);

    push(1);
    await delay(SETTLE);
    expect(collected.values).toEqual([1]);

    push(2);
    end();
    await delay(INTERVAL + SETTLE);

    expect(collected.values).toEqual([1, 2]);
    await expect(collected.done).resolves.toBeUndefined();
  });

  it("propagates a source error after the in-flight value", async () => {
    const { stream, push, fail } = createPushStream<number>();
    const collected = collect(stream);

    push(1);
    await delay(SETTLE);
    expect(collected.values).toEqual([1]);

    fail(new Error("source exploded"));

    await expect(collected.done).rejects.toThrow("source exploded");
  });

  it("stops emitting once the signal is aborted", async () => {
    const controller = new AbortController();
    const { stream, push } = createPushStream<number>();
    const collected = collect(stream, controller.signal);

    push(1);
    await delay(SETTLE);
    expect(collected.values).toEqual([1]);

    controller.abort();
    push(2);

    await expect(collected.done).resolves.toBeUndefined();
    expect(collected.values).toEqual([1]);
  });

  function collect<T>(source: AsyncIterable<T>, signal?: AbortSignal) {
    const values: T[] = [];
    const done = (async () => {
      for await (const value of throttleLatest(source, INTERVAL, { signal })) {
        values.push(value);
      }
    })();
    return { values, done };
  }
});

function createPushStream<T>() {
  const queue: T[] = [];
  let resolveNext: (() => void) | undefined;
  let finished = false;
  let failure: { error: unknown } | undefined;

  const wake = () => {
    resolveNext?.();
    resolveNext = undefined;
  };

  async function* stream(): AsyncGenerator<T> {
    while (true) {
      while (queue.length === 0 && !finished && !failure) {
        await new Promise<void>(resolve => {
          resolveNext = resolve;
        });
      }
      while (queue.length > 0) yield queue.shift() as T;
      if (failure) throw failure.error;
      if (finished) return;
    }
  }

  return {
    stream: stream(),
    push: (value: T) => {
      queue.push(value);
      wake();
    },
    end: () => {
      finished = true;
      wake();
    },
    fail: (error: unknown) => {
      failure = { error };
      wake();
    }
  };
}
