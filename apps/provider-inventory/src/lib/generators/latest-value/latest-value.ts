export interface Signal<T> {
  set(value: T): void;
  close(): void;
  fail(error: unknown): void;
  [Symbol.asyncIterator](): AsyncIterableIterator<T>;
}

export interface SignalOptions {
  signal?: AbortSignal;
}

/**
 * A single-slot, latest-wins cell bridging a fast producer to a slower consumer.
 *
 * Writers call {@link Signal.set} to overwrite the stored value; a single consumer iterates the cell
 * and receives only the most recent value, consuming it. Values written between reads are dropped, so
 * memory stays bounded to one value no matter how fast it is written — a provider pushing inventory
 * several times per second can never make the consumer accumulate a backlog.
 *
 * The producer signals completion with {@link Signal.close} (graceful) or {@link Signal.fail} (error).
 * A value still pending when the cell closes is flushed to the consumer before iteration ends, and an
 * aborted signal ends iteration promptly.
 */
export function latestValue<T>(options?: SignalOptions): Signal<T> {
  let slot: { value: T } | undefined;
  let closed = false;
  let failure: { error: unknown } | undefined;
  let notify: (() => void) | null = null;

  const wake = () => {
    notify?.();
    notify = null;
  };

  return {
    set(value) {
      if (closed) return;
      slot = { value };
      wake();
    },
    close() {
      closed = true;
      wake();
    },
    fail(error) {
      if (closed) return;
      failure = { error };
      closed = true;
      wake();
    },
    async *[Symbol.asyncIterator]() {
      const { signal } = options ?? {};
      signal?.addEventListener("abort", wake, { once: true });
      try {
        while (true) {
          while (!slot && !closed && !signal?.aborted) {
            const { promise, resolve } = Promise.withResolvers<void>();
            notify = resolve;
            await promise;
          }

          if (signal?.aborted) return;

          if (slot) {
            const { value } = slot;
            slot = undefined;
            yield value;
            continue;
          }

          if (failure) throw failure.error;
          return;
        }
      } finally {
        signal?.removeEventListener("abort", wake);
      }
    }
  };
}
