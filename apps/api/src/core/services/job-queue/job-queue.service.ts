import { createMongoAbility, MongoAbility } from "@casl/ability";
import PgBoss from "pg-boss";
import { Disposable, inject, InjectionToken, singleton } from "tsyringe";

import { LoggerService } from "@src/core/providers/logging.provider";
import { CoreConfigService } from "../core-config/core-config.service";
import { ExecutionContextService } from "../execution-context/execution-context.service";

export const PG_BOSS_TOKEN: InjectionToken<PgBoss> = Symbol("pgBoss");

@singleton()
export class JobQueueService implements Disposable {
  private readonly pgBoss: PgBoss;
  private handlers?: JobHandler<Job>[];

  constructor(
    private readonly logger: LoggerService,
    private readonly coreConfig: CoreConfigService,
    private readonly executionContextService: ExecutionContextService,
    @inject(PG_BOSS_TOKEN, { isOptional: true }) pgBoss?: PgBoss
  ) {
    this.pgBoss =
      pgBoss ??
      new PgBoss({
        connectionString: this.coreConfig.get("POSTGRES_DB_URI"),
        schema: this.coreConfig.get("POSTGRES_BACKGROUND_JOBS_SCHEMA"),
        schedule: false
      });
  }

  async registerHandlers(handlers: JobHandler<Job>[]): Promise<void> {
    const seenJobs = new Set<string>();
    const promises = handlers.map(async handler => {
      const queueName = handler.accepts[JOB_NAME];
      if (seenJobs.has(queueName)) {
        throw new Error(`JobQueue does not support multiple handlers for the same queue: ${queueName}`);
      }
      seenJobs.add(queueName);
      await this.pgBoss.createQueue(queueName, {
        name: queueName,
        retryLimit: 5,
        retryBackoff: true,
        retryDelayMax: 5 * 60
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

  /** Starts jobs processing */
  async startWorkers({ concurrency, ...options }: ProcessOptions = {}): Promise<void> {
    if (!this.handlers) throw new Error("Handlers not registered. Register handlers first.");

    const workerOptions = {
      ...options,
      batchSize: 1
    };
    const jobs = this.handlers.map(async handler => {
      const queueName = handler.accepts[JOB_NAME];
      const workersPromises = Array.from({ length: handler.concurrency ?? concurrency ?? 2 }).map(() =>
        this.pgBoss.work<JobPayload<Job>>(queueName, workerOptions, async ([job]) => {
          await this.executionContextService.runWithContext(async () => {
            this.executionContextService.set("CURRENT_USER", {
              id: "bg-job-user",
              bio: "",
              email: "bg-job-user@akash.network",
              emailVerified: false,
              stripeCustomerId: "",
              subscribedToNewsletter: false,
              createdAt: new Date(),
              lastActiveAt: new Date(),
              lastIp: null,
              lastUserAgent: null,
              lastFingerprint: null,
              youtubeUsername: null,
              twitterUsername: null,
              githubUsername: null,
              userId: "system:bg-job-user",
              username: "___bg_job_user___",
              trial: false
            });
            this.executionContextService.set("ABILITY", createMongoAbility<MongoAbility>());
            this.logger.info({
              event: "JOB_STARTED",
              jobId: job.id
            });
            try {
              await handler.handle(job.data);
              this.logger.info({
                event: "JOB_DONE",
                jobId: job.id
              });
            } catch (error) {
              this.logger.error({
                event: "JOB_FAILED",
                jobId: job.id,
                error
              });
              throw error;
            }
          });
        })
      );

      await Promise.all(workersPromises);
    });

    await Promise.all(jobs);
  }

  async dispose(): Promise<void> {
    await this.pgBoss.stop();
  }

  /**
   * Configures tables and initializes schedules
   */
  async setup(): Promise<void> {
    this.logger.info({ event: "JOB_QUEUE_STARTING" });
    this.pgBoss.on("error", error => {
      this.logger.error({ event: "JOB_QUEUE_ERROR", error });
    });
    await this.pgBoss.start();
    this.logger.info({ event: "JOB_QUEUE_STARTED" });
  }

  async ping(): Promise<void> {
    await this.pgBoss.getDb().executeSql("SELECT 1", []);
  }
}

export interface Job {
  /**
   * Version must be changed only if the job data structure changes in a way that would cause a backwards incompatible change.
   * Corresponding job handler must be updated to support the new version of Job payload.
   */
  version: number;
  name: string;
  data: Record<string, unknown>;
}

export type JobPayload<T extends Job> = T["data"] & { version: T["version"] };

export const JOB_NAME = Symbol("name");

export type JobType<T extends Job> = {
  new (...args: any[]): T;
  [JOB_NAME]: string;
};

export interface JobHandler<T extends Job> {
  accepts: JobType<T>;
  concurrency?: ProcessOptions["concurrency"];
  handle(payload: JobPayload<T>): Promise<void>;
}

export type EnqueueOptions = PgBoss.SendOptions;
export interface ProcessOptions extends Omit<PgBoss.WorkOptions, "batchSize"> {
  /**
   * The number of workers to start. Defaults to 2.
   * Specify higher concurrency to process jobs faster. Specify 1 to process jobs one by one.
   */
  concurrency?: number;
}
