import PgBoss from "pg-boss";
import { inject, InjectionToken, singleton } from "tsyringe";

import { LoggerService } from "@src/core/providers/logging.provider";
import { CoreConfigService } from "../core-config/core-config.service";

export const PG_BOSS_TOKEN: InjectionToken<PgBoss> = Symbol("pgBoss");

@singleton()
export class JobQueueService {
  private readonly pgBoss: PgBoss;
  private handlers?: JobHandler<Job>[];

  constructor(
    private readonly logger: LoggerService,
    private readonly coreConfig: CoreConfigService,
    @inject(PG_BOSS_TOKEN, { isOptional: true }) pgBoss?: PgBoss
  ) {
    this.pgBoss =
      pgBoss ??
      new PgBoss({
        connectionString: this.coreConfig.get("POSTGRES_DB_URI"),
        schema: "pgboss"
      });
  }

  async registerHandlers(handlers: JobHandler<Job>[]): Promise<void> {
    const promises = handlers.map(async handler => {
      const queueName = handler.accepts[JOB_NAME];
      await this.pgBoss.createQueue(queueName, {
        name: queueName,
        retryLimit: 10
      });
    });
    await Promise.all(promises);
    this.handlers = handlers.slice(0);
  }

  /**
   * Enqueue a job to the queue.
   *
   * @example
   * ```ts
   * class NotificationJob implements Job {
   *   static readonly [JOB_NAME] = 'notifications';
   *
   *   constructor(
   *     public readonly data: {
   *       type: 'email';
   *       to: string;
   *       subject: string;
   *       body: string;
   *     }
   *   ) {}
   * }
   *
   * const job = new NotificationJob({
   *   type: 'email',
   *   to: 'user@example.com',
   *   subject: 'Welcome!',
   *   body: 'Thanks for signing up'
   * });
   *
   * await jobQueue.enqueue(job);
   * ```
   *
   * @param job - The job to enqueue.
   * @param options - The custom options to enqueue the job with.
   */
  async enqueue(job: Job, options?: EnqueueOptions): Promise<string | null> {
    this.logger.info({
      event: "JOB_ENQUEUED",
      job
    });

    return await this.pgBoss.send({
      name: job.name,
      data: { ...job.data, version: job.version },
      options
    });
  }

  async startWorkers(options: ProcessOptions = {}): Promise<void> {
    if (!this.handlers) throw new Error("Handlers not registered. Register handlers first.");

    const jobs = this.handlers.map(async handler => {
      const queueName = handler.accepts[JOB_NAME];
      await this.pgBoss.createQueue(queueName, {
        name: queueName,
        retryLimit: 10
      });
      await this.pgBoss.work<Job["data"]>(queueName, { batchSize: 10, ...options }, async jobs => {
        this.logger.info({
          event: "JOBS_STARTED",
          jobsIds: jobs.map(job => job.id)
        });
        const promises = jobs.map(async job => handler.handle(job.data));
        const results = await Promise.allSettled(promises);
        results.forEach((result, index) => {
          if (result.status === "fulfilled") {
            this.logger.info({
              event: "JOB_DONE",
              jobId: jobs[index].id
            });
          } else {
            this.logger.error({
              event: "JOB_FAILED",
              jobId: jobs[index].id,
              error: result.reason
            });
          }
        });
      });
    });

    await Promise.all(jobs);
  }

  async dispose(): Promise<void> {
    await this.pgBoss.stop();
  }

  async start(): Promise<void> {
    this.logger.info({ event: "JOB_QUEUE_STARTING" });
    this.pgBoss.on("error", error => {
      this.logger.error({ event: "JOB_QUEUE_ERROR", error });
    });
    await this.pgBoss.start();
    this.logger.info({ event: "JOB_QUEUE_STARTED" });
  }
}

export interface Job {
  version: number;
  name: string;
  data: Record<string, unknown>;
}

export const JOB_NAME = Symbol("name");

export type JobType<T extends Job> = {
  new (...args: any[]): T;
  [JOB_NAME]: string;
};

export interface JobHandler<T extends Job> {
  accepts: JobType<T>;
  handle(job: T["data"]): Promise<void>;
}

export type EnqueueOptions = PgBoss.SendOptions;
export type ProcessOptions = PgBoss.WorkOptions;
