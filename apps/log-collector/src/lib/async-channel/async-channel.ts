/**
 * Minimal async channel — bridges push-based callbacks to pull-based async iteration.
 *
 * Events pushed via `push()` are buffered until consumed. If a consumer is
 * already waiting (via `next()`), the event is delivered immediately.
 * Calling `close()` signals the end of the stream.
 *
 * Implements `AsyncIterable`, so it can be used with `for await` or `yield*`.
 *
 * @example
 * ```typescript
 * const channel = new AsyncChannel<string>();
 *
 * // Producer side (callback-based)
 * someEmitter.on("data", (value) => channel.push(value));
 * someEmitter.on("end", () => channel.close());
 *
 * // Consumer side (async iteration)
 * for await (const value of channel) {
 *   console.log(value);
 * }
 * ```
 */
export class AsyncChannel<T> {
  private queue: T[] = [];

  private waiting: ((result: IteratorResult<T>) => void) | null = null;

  private done = false;

  /** Enqueues a value. If a consumer is waiting, delivers it immediately. */
  push(value: T): void {
    if (this.done) return;

    if (this.waiting) {
      const resolve = this.waiting;
      this.waiting = null;
      resolve({ value, done: false });
    } else {
      this.queue.push(value);
    }
  }

  /** Closes the channel. Any pending or future `next()` calls will return `done: true`. */
  close(): void {
    this.done = true;

    if (this.waiting) {
      const resolve = this.waiting;
      this.waiting = null;
      resolve({ value: undefined as T, done: true });
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: () => {
        if (this.queue.length > 0) {
          return Promise.resolve({ value: this.queue.shift()!, done: false });
        }

        if (this.done) {
          return Promise.resolve({ value: undefined as T, done: true });
        }

        return new Promise<IteratorResult<T>>(resolve => {
          this.waiting = resolve;
        });
      }
    };
  }
}
