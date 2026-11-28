type Stored<T> = { value: T; sequence: number; readAtMs: number };

/** Keeps the last answer read from a store for a bounded time, so a failed read can fall back on it without trusting an old answer for long. */
export class RecentRead<T> {
  #issuedReads = 0;
  #last: Stored<T> | undefined;

  constructor(private readonly maxAgeMs: number) {}

  /** Overlapping reads can finish out of order, so an answer is kept only if no read issued after it has stored one, and it ages from when it was asked for. */
  async refresh(read: () => Promise<T>): Promise<T> {
    const sequence = ++this.#issuedReads;
    const readAtMs = Date.now();
    const value = await read();

    if (!this.#last || sequence > this.#last.sequence) this.#last = { value, sequence, readAtMs };

    return value;
  }

  /** Wrapped, because a stored `undefined` is an answer and must stay distinct from having none. */
  recall(): { value: T } | undefined {
    const last = this.#last;

    return last && Date.now() - last.readAtMs <= this.maxAgeMs ? { value: last.value } : undefined;
  }
}
