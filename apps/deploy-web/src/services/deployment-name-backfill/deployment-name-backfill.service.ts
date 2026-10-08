interface Backfill {
  key: string;
  run: () => Promise<unknown>;
  settle: (isSent: boolean) => void;
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

  /** Resolves whether this call's own backfill landed, so a caller is never left waiting on one the session already attempted or a rename dropped. */
  enqueue(owner: string, dseq: string, run: () => Promise<unknown>): Promise<boolean> {
    const key = toDeploymentKey(owner, dseq);

    if (this.#attempted.has(key)) return Promise.resolve(false);

    this.#attempted.add(key);
    const isSent = new Promise<boolean>(settle => {
      this.#queued.push({ key, run, settle });
    });

    if (!this.#inFlight) void this.#drain();

    return isSent;
  }

  /** A rename takes the name over: a queued backfill is dropped, one already writing is waited out, and none runs for that deployment later this session. */
  async preempt(owner: string, dseq: string): Promise<void> {
    const key = toDeploymentKey(owner, dseq);
    this.#attempted.add(key);

    const queuedIndex = this.#queued.findIndex(backfill => backfill.key === key);
    if (queuedIndex >= 0) this.#queued.splice(queuedIndex, 1)[0].settle(false);

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

      const settled = Promise.allSettled([next.run()]).then(([outcome]) => next.settle(outcome.status === "fulfilled"));
      this.#inFlight = { key: next.key, settled };
      await settled;
    }
  }
}
