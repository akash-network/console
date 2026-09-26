import { metrics } from "@opentelemetry/api";
import { eq, sql } from "drizzle-orm";
import { inject, singleton } from "tsyringe";

import { JobRuns } from "@src/db/schema";
import type { JobRunObserver } from "@src/jobs/job-scheduler";
import type { ChainDatabase } from "@src/providers/db.provider";
import { CHAIN_DB } from "@src/providers/db.provider";
import { LoggerService } from "@src/providers/logging.provider";

/** Every job outcome lands in three places: a structured log line, the OpenTelemetry job counters, and the `job_runs` row that `/v1/status` shows. */
@singleton()
export class JobRunRecorder implements JobRunObserver {
  readonly #db: ChainDatabase;
  readonly #logger: LoggerService;
  readonly #meter = metrics.getMeter("chain-indexer-jobs");
  readonly #runs = this.#meter.createCounter("indexer_job_runs_total", { description: "Job runs by outcome" });
  readonly #duration = this.#meter.createHistogram("indexer_job_duration_ms", { description: "Job run duration", unit: "ms" });

  constructor(@inject(CHAIN_DB) db: ChainDatabase, @inject(LoggerService) logger: LoggerService) {
    this.#db = db;
    this.#logger = logger;
    this.#logger.setContext("JOBS");
  }

  async onStart(name: string): Promise<void> {
    this.#logger.info({ event: "JOB_STARTED", job: name });
    const startedAt = new Date();
    await this.#db
      .insert(JobRuns)
      .values({ name, lastStartedAt: startedAt, lastFinishedAt: null, lastStatus: "running", lastError: null })
      .onConflictDoUpdate({ target: JobRuns.name, set: { lastStartedAt: startedAt, lastFinishedAt: null, lastStatus: "running", lastError: null } });
  }

  async onSuccess(name: string, durationMs: number): Promise<void> {
    this.#logger.info({ event: "JOB_COMPLETED", job: name, durationMs });
    this.#record(name, "success", durationMs);
    await this.#db
      .update(JobRuns)
      .set({ lastFinishedAt: new Date(), lastStatus: "success", lastError: null, successCount: sql`${JobRuns.successCount} + 1` })
      .where(eq(JobRuns.name, name));
  }

  async onFailure(name: string, durationMs: number, error: unknown): Promise<void> {
    this.#logger.error({ event: "JOB_FAILED", job: name, durationMs, error });
    this.#record(name, "failure", durationMs);
    await this.#db
      .update(JobRuns)
      .set({ lastFinishedAt: new Date(), lastStatus: "failure", lastError: errorMessage(error), failureCount: sql`${JobRuns.failureCount} + 1` })
      .where(eq(JobRuns.name, name));
  }

  #record(name: string, status: "success" | "failure", durationMs: number): void {
    this.#runs.add(1, { job: name, status });
    this.#duration.record(durationMs, { job: name, status });
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
