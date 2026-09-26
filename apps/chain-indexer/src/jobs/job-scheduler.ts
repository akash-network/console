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

interface ScheduledJob {
  definition: JobDefinition;
  running: Promise<void> | null;
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
    this.#jobs.set(definition.name, { definition, running: null });
  }

  start(): void {
    for (const job of this.#jobs.values()) {
      if (job.definition.runAtStart) {
        this.#tick(job);
      }
      this.#timers.push(setInterval(() => this.#tick(job), job.definition.intervalMs));
    }
  }

  async stop(): Promise<void> {
    for (const timer of this.#timers.splice(0)) {
      clearInterval(timer);
    }
    await Promise.allSettled([...this.#jobs.values()].map(job => job.running));
  }

  #tick(job: ScheduledJob): void {
    if (job.running) {
      this.#logger.warn({ event: "JOB_TICK_SKIPPED", job: job.definition.name });
      return;
    }
    job.running = this.#run(job.definition).finally(() => {
      job.running = null;
    });
  }

  async #run(definition: JobDefinition): Promise<void> {
    const startedAt = Date.now();
    await this.#observer.onStart(definition.name);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error(`Job "${definition.name}" timed out after ${definition.timeoutMs} ms`)), definition.timeoutMs);
    const abortion = rejectOnAbort(controller.signal);

    try {
      await Promise.race([abortion, definition.run(controller.signal)]);
      await this.#observer.onSuccess(definition.name, Date.now() - startedAt);
    } catch (error) {
      await this.#observer.onFailure(definition.name, Date.now() - startedAt, error);
    } finally {
      clearTimeout(timeout);
    }
  }
}

/** Listens before the job starts, so a job that resolves on abort still loses the race to the timeout error. */
function rejectOnAbort(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
}
