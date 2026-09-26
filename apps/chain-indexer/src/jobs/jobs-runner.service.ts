import { inject, singleton } from "tsyringe";

import type { EnvConfig } from "@src/config/env.config";
import { JobRunRecorder } from "@src/jobs/job-run-recorder.service";
import { JobScheduler } from "@src/jobs/job-scheduler";
import { KeybaseIdentitiesJob } from "@src/jobs/keybase-identities/keybase-identities.job";
import { PriceHistoryJob } from "@src/jobs/price-history/price-history.job";
import { APP_CONFIG } from "@src/providers/app-config.provider";
import { LoggerService } from "@src/providers/logging.provider";

/** The jobs role: the chain-adjacent side tasks on their own schedules, off the ingestion path, until the process is asked to stop. */
@singleton()
export class JobsRunnerService {
  readonly #recorder: JobRunRecorder;
  readonly #priceHistory: PriceHistoryJob;
  readonly #keybaseIdentities: KeybaseIdentitiesJob;
  readonly #config: EnvConfig;
  readonly #logger: LoggerService;

  #resolveDisposed: () => void = () => undefined;
  readonly #disposed = new Promise<void>(resolve => {
    this.#resolveDisposed = resolve;
  });

  constructor(
    @inject(JobRunRecorder) recorder: JobRunRecorder,
    @inject(PriceHistoryJob) priceHistory: PriceHistoryJob,
    @inject(KeybaseIdentitiesJob) keybaseIdentities: KeybaseIdentitiesJob,
    @inject(APP_CONFIG) config: EnvConfig,
    @inject(LoggerService) logger: LoggerService
  ) {
    this.#recorder = recorder;
    this.#priceHistory = priceHistory;
    this.#keybaseIdentities = keybaseIdentities;
    this.#config = config;
    this.#logger = logger;
    this.#logger.setContext("JOBS");
  }

  async start(): Promise<void> {
    const scheduler = new JobScheduler(this.#recorder, this.#logger);
    const jobs: string[] = [];

    if (this.#config.PRICE_COINGECKO_ID) {
      scheduler.register({
        name: "price-history",
        intervalMs: this.#config.PRICE_SYNC_INTERVAL_MS,
        timeoutMs: this.#config.JOB_TIMEOUT_MS,
        runAtStart: true,
        run: signal => this.#priceHistory.run(signal)
      });
      jobs.push("price-history");
    }
    scheduler.register({
      name: "keybase-identities",
      intervalMs: this.#config.KEYBASE_SYNC_INTERVAL_MS,
      timeoutMs: this.#config.JOB_TIMEOUT_MS,
      runAtStart: true,
      run: signal => this.#keybaseIdentities.run(signal)
    });
    jobs.push("keybase-identities");

    scheduler.start();
    this.#logger.info({ event: "JOBS_STARTED", jobs });

    await this.#disposed;
    await scheduler.stop();
    this.#logger.info({ event: "JOBS_STOPPED" });
  }

  async dispose(): Promise<void> {
    this.#resolveDisposed();
  }
}
