import type { LoggerService } from "@src/providers/logging.provider";

export interface JobDefinition {
  name: string;
  intervalMs: number;
  timeoutMs: number;
  runAtStart?: boolean;
  run: (signal: AbortSignal) => Promise<void>;
}

export interface JobRunObserver {
  onStart(name: string): Promise<void> | void;
  onSuccess(name: string, durationMs: number): Promise<void> | void;
  onFailure(name: string, durationMs: number, error: unknown): Promise<void> | void;
}

/** Shorter than the usual 30 s Kubernetes termination grace, so an aborted run is still recorded before the process is killed. */
const STOP_GRACE_MS = 10_000;

/** The job's timeout guards only the job, so a stalled observer write needs its own bound or it pins the run forever. */
const OBSERVER_TIMEOUT_MS = 30_000;

interface ScheduledJob {
  definition: JobDefinition;
  running: Promise<void> | null;
  /** The job body itself, which may outlive its timeout; the slot stays taken until it settles so two runs never overlap. */
  inFlight: Promise<void> | null;
  controller: AbortController | null;
}

/**
 * Runs each registered job on its own interval, one run at a time: a tick that finds the previous run
 * still in flight is skipped, and a run past its timeout is aborted and recorded as a failure, so a
 * hanging scrape can neither pile up nor pin the process. Outcomes go to the observer, never thrown.
 */
export class JobScheduler {
  readonly #observer: JobRunObserver;
  readonly #logger: LoggerService;
  readonly #jobs = new Map<string, ScheduledJob>();
  readonly #timers: NodeJS.Timeout[] = [];

  constructor(observer: JobRunObserver, logger: LoggerService) {
    this.#observer = observer;
    this.#logger = logger;
  }

  register(definition: JobDefinition): void {
    if (this.#jobs.has(definition.name)) {
      throw new Error(`Job "${definition.name}" is already registered`);
    }
    this.#jobs.set(definition.name, { definition, running: null, inFlight: null, controller: null });
  }

  start(): void {
    for (const job of this.#jobs.values()) {
      if (job.definition.runAtStart) {
        this.#tick(job);
      }
      this.#timers.push(setInterval(() => this.#tick(job), job.definition.intervalMs));
    }
  }

  /** In-flight runs get a short grace to finish, then are aborted, so a shutdown ends within the pod's termination window instead of the job's timeout. */
  async stop(): Promise<void> {
    for (const timer of this.#timers.splice(0)) {
      clearInterval(timer);
    }
    const abortInFlight = setTimeout(() => {
      for (const job of this.#jobs.values()) {
        job.controller?.abort(new Error(`Job "${job.definition.name}" stopped by scheduler shutdown`));
      }
    }, STOP_GRACE_MS);
    try {
      await Promise.allSettled([...this.#jobs.values()].map(job => job.running));
    } finally {
      clearTimeout(abortInFlight);
    }
  }

  #tick(job: ScheduledJob): void {
    if (job.running || job.inFlight) {
      this.#logger.warn({ event: "JOB_TICK_SKIPPED", job: job.definition.name });
      return;
    }
    job.running = this.#run(job).finally(() => {
      job.running = null;
      job.controller = null;
    });
  }

  async #run(job: ScheduledJob): Promise<void> {
    const { definition } = job;
    const startedAt = Date.now();
    await this.#notify(definition.name, () => this.#observer.onStart(definition.name));

    const controller = new AbortController();
    job.controller = controller;
    const timeout = setTimeout(() => controller.abort(new Error(`Job "${definition.name}" timed out after ${definition.timeoutMs} ms`)), definition.timeoutMs);
    const abortion = rejectOnAbort(controller.signal);

    const body = definition.run(controller.signal);
    const settled = body.then(
      () => undefined,
      () => undefined
    );
    job.inFlight = settled;
    void settled.then(() => {
      if (job.inFlight === settled) {
        job.inFlight = null;
      }
    });

    try {
      await Promise.race([abortion, body]);
      await this.#notify(definition.name, () => this.#observer.onSuccess(definition.name, Date.now() - startedAt));
    } catch (error) {
      await this.#notify(definition.name, () => this.#observer.onFailure(definition.name, Date.now() - startedAt, error));
    } finally {
      clearTimeout(timeout);
    }
  }

  /** An observer that fails or stalls (its own database write, say) must cost one record, never the scheduler's promise that nothing is thrown. */
  async #notify(name: string, record: () => Promise<void> | void): Promise<void> {
    let deadline: NodeJS.Timeout | undefined;
    const expiry = new Promise<never>((_, reject) => {
      deadline = setTimeout(() => reject(new Error(`Job "${name}" observer did not answer within ${OBSERVER_TIMEOUT_MS} ms`)), OBSERVER_TIMEOUT_MS);
    });
    try {
      await Promise.race([Promise.resolve().then(record), expiry]);
    } catch (error) {
      this.#logger.error({ event: "JOB_OBSERVER_FAILED", job: name, error });
    } finally {
      clearTimeout(deadline);
    }
  }
}

/** Listens before the job starts, so a job that resolves on abort still loses the race to the timeout error. */
function rejectOnAbort(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
}
