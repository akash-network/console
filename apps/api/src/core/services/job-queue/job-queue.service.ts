import { createMongoAbility, MongoAbility } from "@casl/ability";
import { context, propagation, SpanStatusCode, trace } from "@opentelemetry/api";
import { Job as PgBossJob, PgBoss, Queue as PgBossQueue, SendOptions as PgBossSendOptions, WorkOptions as PgBossWorkOptions } from "pg-boss";
import type { Sql } from "postgres";
import { Disposable, inject, InjectionToken, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { CoreConfigService } from "../core-config/core-config.service";
import { ExecutionContextService } from "../execution-context/execution-context.service";
import { TxService } from "../tx/tx.service";

export const PG_BOSS_TOKEN: InjectionToken<PgBoss> = Symbol("pgBoss");

type QueueRetryOptions = Pick<PgBossQueue, "retryLimit" | "retryBackoff" | "retryDelay" | "retryDelayMax">;

/** pg-boss multiplies its backoff by `retryDelay` and defaults it to 0, which would collapse every retry gap to zero. */
const QUEUE_RETRY_OPTIONS: QueueRetryOptions = {
  retryLimit: 5,
  retryBackoff: true,
  retryDelay: 30,
  retryDelayMax: 5 * 60
};

const DEFAULT_QUEUE_POLICY: PgBossQueue["policy"] = "standard";

const RETRY_OPTION_KEYS = Object.keys(QUEUE_RETRY_OPTIONS) as (keyof QueueRetryOptions)[];

function retryOptionsOf(queue: QueueRetryOptions) {
  return RETRY_OPTION_KEYS.map(key => [key, queue[key]] as const);
}

@singleton()
export class JobQueueService implements Disposable {
  private readonly pgBoss: PgBoss;
  private handlers?: JobHandler<Job>[];
  private readonly tracer = trace.getTracer("job-queue");
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    @inject(LOGGER_FACTORY) createLogger: CreateLogger,
    private readonly coreConfig: CoreConfigService,
    private readonly executionContextService: ExecutionContextService,
    private readonly txService: TxService,
    @inject(PG_BOSS_TOKEN, { isOptional: true }) pgBoss?: PgBoss
  ) {
    this.logger = createLogger({ context: JobQueueService.name });
    this.pgBoss =
      pgBoss ??
      new PgBoss({
        connectionString: this.coreConfig.get("POSTGRES_DB_URI"),
        schema: this.coreConfig.get("POSTGRES_BACKGROUND_JOBS_SCHEMA"),
        schedule: false,
        max: this.coreConfig.get("POSTGRES_BACKGROUND_JOBS_POOL_SIZE"),
        connectionTimeoutMillis: this.coreConfig.get("POSTGRES_BACKGROUND_JOBS_CONNECT_TIMEOUT") * 1000
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
      await this.pgBoss.createQueue(queueName, { ...QUEUE_RETRY_OPTIONS, policy: handler.policy });
    });
    await Promise.all(promises);
    await this.#convergeRetryOptions(handlers);
    this.handlers = handlers.slice(0);
  }

  /**
   * `createQueue` never touches a queue that already exists, so settings corrected in code reach production only from here.
   * A failure leaves the queues as they were, which is why it is logged rather than raised: it must not keep workers down.
   */
  async #convergeRetryOptions(handlers: JobHandler<Job>[]): Promise<void> {
    try {
      const queueNames = handlers.map(handler => handler.accepts[JOB_NAME]);
      const liveQueues = new Map((await this.pgBoss.getQueues(queueNames)).map(queue => [queue.name, queue]));

      for (const handler of handlers) {
        const queue = liveQueues.get(handler.accepts[JOB_NAME]);
        if (!queue) continue;

        const declaredPolicy = handler.policy ?? DEFAULT_QUEUE_POLICY;
        if (queue.policy !== declaredPolicy) {
          this.logger.warn({
            event: "JOB_QUEUE_POLICY_UNCHANGEABLE",
            queue: queue.name,
            declared: declaredPolicy,
            live: queue.policy
          });
        }

        if (retryOptionsOf(queue).every(([key, value]) => value === QUEUE_RETRY_OPTIONS[key])) continue;

        await this.pgBoss.updateQueue(queue.name, QUEUE_RETRY_OPTIONS);
        this.logger.info({
          event: "JOB_QUEUE_RETRY_OPTIONS_CONVERGED",
          queue: queue.name,
          from: Object.fromEntries(retryOptionsOf(queue)),
          to: QUEUE_RETRY_OPTIONS
        });
      }
    } catch (error) {
      this.logger.error({ event: "JOB_QUEUE_RETRY_OPTIONS_CONVERGE_FAILED", error });
    }
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
    const connection = this.txService.getConnection();
    const jobId = await this.pgBoss.send({
      name: job.name,
      data: { ...job.data, version: job.version },
      options: { ...options, db: connection ? this.#toTransactionDb(connection) : undefined }
    });

    this.logger.info({
      event: "JOB_ENQUEUED",
      job,
      jobId,
      options
    });

    return jobId;
  }

  #toTransactionDb(connection: Sql): NonNullable<EnqueueOptions["db"]> {
    return {
      async executeSql(text, values) {
        return { rows: await connection.unsafe(text, values as Parameters<typeof connection.unsafe>[1]) };
      }
    };
  }

  async cancel(name: string, id: string): Promise<void> {
    try {
      await this.pgBoss.cancel(name, id);
      this.logger.info({
        event: "JOB_CANCELLED",
        jobId: id,
        name
      });
    } catch (error) {
      if (this.isTerminalStateError(error)) {
        this.logger.warn({
          event: "JOB_CANCEL_FAILED",
          jobId: id,
          name,
          error
        });
      } else {
        throw error;
      }
    }
  }

  /** Singleton keys of the queue's jobs that have not finished: queued, waiting on a retry, or running. */
  async findPendingSingletonKeys(name: string): Promise<Set<string>> {
    const connection = this.txService.getConnection();
    const db = connection ? this.#toTransactionDb(connection) : await this.pgBoss.getDb();
    const schema = this.coreConfig.get("POSTGRES_BACKGROUND_JOBS_SCHEMA");
    const result = (await db.executeSql(
      `
        SELECT DISTINCT singleton_key
        FROM ${schema}.job
        WHERE name = $1
          AND state IN ('created', 'retry', 'active')
          AND singleton_key IS NOT NULL
      `,
      [name]
    )) as { rows: { singleton_key: string }[] };

    return new Set(result.rows.map(row => row.singleton_key));
  }

  async cancelCreatedBy(query: { name: string; singletonKey: string }): Promise<void> {
    const connection = this.txService.getConnection();
    const db = connection ? this.#toTransactionDb(connection) : await this.pgBoss.getDb();
    const schema = this.coreConfig.get("POSTGRES_BACKGROUND_JOBS_SCHEMA");
    const result = (await db.executeSql(
      `
        WITH results as (
          UPDATE ${schema}.job
          SET completed_on = now(),
            state = 'cancelled'
          WHERE name = $1
            AND state IN ('created', 'retry')
            AND singleton_key = $2
          RETURNING id
        )
        SELECT id FROM results
      `,
      [query.name, query.singletonKey]
    )) as { rows: { id: string }[] };

    this.logger.info({
      event: "JOBS_CANCELLED",
      jobIds: result.rows.map(r => r.id)
    });
  }

  async complete(name: string, id: string): Promise<void> {
    try {
      await this.pgBoss.complete(name, id);
      this.logger.info({
        event: "JOB_COMPLETED",
        jobId: id,
        name
      });
    } catch (error) {
      if (this.isTerminalStateError(error)) {
        this.logger.warn({
          event: "JOB_COMPLETE_FAILED",
          jobId: id,
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
                onboardingSkippedAt: null,
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

export type JobMeta = Pick<PgBossJob, "id">;

export interface JobHandler<T extends Job> {
  accepts: JobType<T>;
  concurrency?: ProcessOptions["concurrency"];
  policy?: PgBossQueue["policy"];
  handle(payload: JobPayload<T>, job?: JobMeta): Promise<void>;
}

export type EnqueueOptions = PgBossSendOptions;
export interface ProcessOptions extends Omit<PgBossWorkOptions, "batchSize"> {
  /**
   * The number of workers to start. Defaults to 2.
   * Specify higher concurrency to process jobs faster. Specify 1 to process jobs one by one.
   */
  concurrency?: number;
}
