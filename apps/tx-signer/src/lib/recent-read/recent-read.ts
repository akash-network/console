/** Keeps the last value read from a store for a bounded time, so a failed read can fall back on it without trusting an old answer for long. */
export class RecentRead<T> {
  #last: { value: T; readAtMs: number } | undefined;

  constructor(private readonly maxAgeMs: number) {}

  remember(value: T): T {
    this.#last = { value, readAtMs: Date.now() };

    return value;
  }

  /** Wrapped, because a remembered `undefined` is an answer and must stay distinct from having none. */
  recall(): { value: T } | undefined {
    const last = this.#last;

    return last && Date.now() - last.readAtMs <= this.maxAgeMs ? { value: last.value } : undefined;
  }
}
