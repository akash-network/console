interface Backfill {
  key: string;
  run: () => Promise<unknown>;
}

/** A dseq names a deployment only together with its owner, and one page session outlives a change of wallet. */
function toDeploymentKey(owner: string, dseq: string): string {
  return `${owner}/${dseq}`;
}

/** Copies names this browser recorded before the console held them into the api, one at a time and at most once per deployment per session. */
export class DeploymentNameBackfillService {
  readonly #attempted = new Set<string>();
  readonly #queued: Backfill[] = [];
  #inFlight: { key: string; settled: Promise<unknown> } | null = null;

  enqueue(owner: string, dseq: string, run: () => Promise<unknown>): void {
    const key = toDeploymentKey(owner, dseq);

    if (this.#attempted.has(key)) return;

    this.#attempted.add(key);
    this.#queued.push({ key, run });

    if (!this.#inFlight) void this.#drain();
  }

  /** A rename takes the name over: a queued backfill is dropped, one already writing is waited out, and none runs for that deployment later this session. */
  async preempt(owner: string, dseq: string): Promise<void> {
    const key = toDeploymentKey(owner, dseq);
    this.#attempted.add(key);

    const queuedIndex = this.#queued.findIndex(backfill => backfill.key === key);
    if (queuedIndex >= 0) this.#queued.splice(queuedIndex, 1);

    if (this.#inFlight?.key === key) await this.#inFlight.settled;
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
      this.#inFlight = { key: next.key, settled };
      await settled;
    }
  }
}
