import { createMongoAbility, MongoAbility } from "@casl/ability";
import { context, propagation, SpanStatusCode, trace } from "@opentelemetry/api";
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
  private readonly tracer = trace.getTracer("job-queue");

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
        retryDelayMax: 5 * 60,
        policy: handler.policy
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
    const jobId = await this.pgBoss.send({
      name: job.name,
      data: { ...job.data, version: job.version },
      options
    });

    this.logger.info({
      event: "JOB_ENQUEUED",
      job,
      jobId,
      options
    });

    return jobId;
  }

  async cancel(name: string, id: string): Promise<void> {
    try {
      await this.pgBoss.cancel(name, id);
      this.logger.info({
        event: "JOB_CANCELLED",
        id,
        name
      });
    } catch (error) {
      if (this.isTerminalStateError(error)) {
        this.logger.warn({
          event: "JOB_CANCEL_FAILED",
          id,
          name,
          error
        });
      } else {
        throw error;
      }
    }
  }

  async complete(name: string, id: string): Promise<void> {
    try {
      await this.pgBoss.complete(name, id);
      this.logger.info({
        event: "JOB_COMPLETED",
        id,
        name
      });
    } catch (error) {
      if (this.isTerminalStateError(error)) {
        this.logger.warn({
          event: "JOB_COMPLETE_FAILED",
          id,
          name,
          error
        });
      } else {
        throw error;
      }
    }
  }

  private isTerminalStateError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const terminalStatePatterns = [
      /job.+not found/i,
      /job.+already.+completed/i,
      /job.+already.+cancelled/i,
      /job.+already.+failed/i,
      /job.+in.+terminal.+state/i,
      /cannot.+cancel.+job/i,
      /cannot.+complete.+job/i
    ];

    return terminalStatePatterns.some(pattern => pattern.test(error.message));
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
          await this.#executeWithOtelContext(queueName, job.id, async () => {
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
                await handler.handle(job.data, { id: job.id });
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
          });
        })
      );

      await Promise.all(workersPromises);
    });

    await Promise.all(jobs);
  }

  async #executeWithOtelContext<T>(queueName: string, jobId: string, handler: () => Promise<T>): Promise<T> {
    const span = this.tracer.startSpan(`job.${queueName}`);
    span.setAttribute("job.id", jobId);
    span.setAttribute("job.name", queueName);

    const activeContext = context.active();
    const baggage = propagation.createBaggage().setEntry("job.id", { value: jobId });
    const contextWithBaggage = propagation.setBaggage(activeContext, baggage);
    const contextWithSpan = trace.setSpan(contextWithBaggage, span);

    try {
      const result = await context.with(contextWithSpan, async () => {
        return await handler();
      });
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error)
      });
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      span.end();
    }
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

export type JobMeta = Pick<PgBoss.Job, "id">;

export interface JobHandler<T extends Job> {
  accepts: JobType<T>;
  concurrency?: ProcessOptions["concurrency"];
  policy?: PgBoss.Queue["policy"];
  handle(payload: JobPayload<T>, job?: JobMeta): Promise<void>;
}

export type EnqueueOptions = PgBoss.SendOptions;
export interface ProcessOptions extends Omit<PgBoss.WorkOptions, "batchSize"> {
  /**
   * The number of workers to start. Defaults to 2.
   * Specify higher concurrency to process jobs faster. Specify 1 to process jobs one by one.
   */
  concurrency?: number;
}
