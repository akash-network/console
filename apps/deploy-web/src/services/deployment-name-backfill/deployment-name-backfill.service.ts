interface Backfill {
  dseq: string;
  run: () => Promise<unknown>;
}

/** Copies names this browser recorded before the console held them into the api, one at a time and at most once per deployment per session. */
export class DeploymentNameBackfillService {
  readonly #attempted = new Set<string>();
  readonly #queued: Backfill[] = [];
  #inFlight: { dseq: string; settled: Promise<unknown> } | null = null;

  enqueue(dseq: string, run: () => Promise<unknown>): void {
    if (this.#attempted.has(dseq)) return;

    this.#attempted.add(dseq);
    this.#queued.push({ dseq, run });

    if (!this.#inFlight) void this.#drain();
  }

  /** A rename takes the name over: a queued backfill is dropped, one already writing is waited out, and none runs for that deployment later this session. */
  async preempt(dseq: string): Promise<void> {
    this.#attempted.add(dseq);

    const queuedIndex = this.#queued.findIndex(backfill => backfill.dseq === dseq);
    if (queuedIndex >= 0) this.#queued.splice(queuedIndex, 1);

    if (this.#inFlight?.dseq === dseq) await this.#inFlight.settled;
  }

  /** One at a time: each backfill costs the api a chain read and a provider round trip per live lease. */
  async #drain(): Promise<void> {
    while (true) {
      const next = this.#queued.shift();

      if (!next) {
        this.#inFlight = null;
        return;
      }

      const settled = Promise.allSettled([next.run()]);
      this.#inFlight = { dseq: next.dseq, settled };
      await settled;
    }
  }
}
