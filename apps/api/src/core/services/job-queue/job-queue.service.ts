import { createMongoAbility, MongoAbility } from "@casl/ability";
import { context, propagation, SpanStatusCode, trace } from "@opentelemetry/api";
import { Job as PgBossJob, PgBoss, Queue as PgBossQueue, SendOptions as PgBossSendOptions, WorkOptions as PgBossWorkOptions } from "pg-boss";
import { Disposable, inject, InjectionToken, singleton } from "tsyringe";

import { LoggerService } from "@src/core/providers/logging.provider";
import { CoreConfigService } from "../core-config/core-config.service";
import { ExecutionContextService } from "../execution-context/execution-context.service";

export const PG_BOSS_TOKEN: InjectionToken<PgBoss> = Symbol("pgBoss");

@singleton()
export class JobQueueService implements Disposable {
  private readonly pgBoss: PgBoss;
  private handlers?: RegisteredHandler[];
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
        schedule: false,
        max: this.coreConfig.get("POSTGRES_BACKGROUND_JOBS_POOL_SIZE"),
        connectionTimeoutMillis: this.coreConfig.get("POSTGRES_BACKGROUND_JOBS_CONNECT_TIMEOUT") * 1000
      });
  }

  /**
   * Registers command handlers. Each command is delivered to a single queue named after
   * the command and processed by exactly one handler.
   */
  async registerHandlers(handlers: JobHandler<Job>[]): Promise<void> {
    await this.#registerQueues(
      handlers.map(handler => ({
        queueName: handler.accepts[JOB_NAME],
        policy: handler.policy,
        concurrency: handler.concurrency,
        handle: handler.handle.bind(handler)
      }))
    );
  }

  /**
   * Registers domain event handlers using pg-boss publish/subscribe. A single event can have
   * multiple handlers, each owning its own queue so it fails, retries, and restarts in isolation.
   * The queue defaults to the event name and takes a `<eventName>.<queue>` suffix when a handler
   * declares its own `queue`, allowing several handlers to subscribe to the same event.
   */
  async registerEventHandlers(handlers: EventHandler<Job>[]): Promise<void> {
    await this.#registerQueues(
      handlers.map(handler => {
        const eventName = handler.accepts[JOB_NAME];
        return {
          queueName: handler.queue ? `${eventName}.${handler.queue}` : eventName,
          subscribesTo: eventName,
          policy: handler.policy,
          concurrency: handler.concurrency,
          handle: handler.handle.bind(handler)
        };
      })
    );
  }

  async #registerQueues(registrations: QueueRegistration[]): Promise<void> {
    this.handlers ??= [];
    const seenQueues = new Set(this.handlers.map(handler => handler.queueName));

    const promises = registrations.map(async registration => {
      const { queueName, subscribesTo, policy, concurrency, handle } = registration;
      if (seenQueues.has(queueName)) {
        throw new Error(`JobQueue does not support multiple handlers for the same queue: ${queueName}`);
      }
      seenQueues.add(queueName);
      this.handlers!.push({ queueName, concurrency, handle });

      await this.pgBoss.createQueue(queueName, {
        retryLimit: 5,
        retryBackoff: true,
        retryDelayMax: 5 * 60,
        policy
      });

      if (subscribesTo) {
        await this.pgBoss.subscribe(subscribesTo, queueName);
      }
    });

    await Promise.all(promises);
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

  /**
   * Publishes a domain event to every queue subscribed to it via {@link registerEventHandlers}.
   * Unlike {@link enqueue}, this fans out to all subscribers and therefore returns no single job id.
   */
  async publish(event: Job, options?: EnqueueOptions): Promise<void> {
    await this.pgBoss.publish(event.name, { ...event.data, version: event.version }, options);

    this.logger.info({
      event: "EVENT_PUBLISHED",
      domainEvent: event,
      options
    });
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

  async cancelCreatedBy(query: { name: string; singletonKey: string }): Promise<void> {
    const db = await this.pgBoss.getDb();
    const schema = this.coreConfig.get("POSTGRES_BACKGROUND_JOBS_SCHEMA");
    const result = (await db.executeSql(
      `
        WITH results as (
          UPDATE ${schema}.job
          SET completed_on = now(),
            state = 'cancelled'
          WHERE name = $1
            AND state = 'created'
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
      const queueName = handler.queueName;
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

export type JobMeta = Pick<PgBossJob, "id">;

export interface JobHandler<T extends Job> {
  accepts: JobType<T>;
  concurrency?: ProcessOptions["concurrency"];
  policy?: PgBossQueue["policy"];
  handle(payload: JobPayload<T>, job?: JobMeta): Promise<void>;
}

export interface EventHandler<T extends Job> {
  accepts: JobType<T>;
  /**
   * Distinct subscriber queue suffix. Enables multiple independent handlers for one event.
   * When omitted the queue is named after the event itself, otherwise it becomes `<eventName>.<queue>`.
   */
  queue?: string;
  concurrency?: ProcessOptions["concurrency"];
  policy?: PgBossQueue["policy"];
  handle(payload: JobPayload<T>, job?: JobMeta): Promise<void>;
}

interface QueueRegistration {
  queueName: string;
  /** When set, the queue is subscribed to this event so published events fan out to it. */
  subscribesTo?: string;
  policy?: PgBossQueue["policy"];
  concurrency?: ProcessOptions["concurrency"];
  handle: JobHandler<Job>["handle"];
}

type RegisteredHandler = Pick<QueueRegistration, "queueName" | "concurrency" | "handle">;

export type EnqueueOptions = PgBossSendOptions;
export interface ProcessOptions extends Omit<PgBossWorkOptions, "batchSize"> {
  /**
   * The number of workers to start. Defaults to 2.
   * Specify higher concurrency to process jobs faster. Specify 1 to process jobs one by one.
   */
  concurrency?: number;
}
