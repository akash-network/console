import { addMinutes, addSeconds, secondsToMilliseconds } from "date-fns";
import { sql } from "drizzle-orm";
import { PgBoss, type Queue as PgBossQueue } from "pg-boss";
import { container } from "tsyringe";
import { afterAll, describe, expect, it, vi } from "vitest";

import type { ApiPgDatabase } from "@src/core";
import { type EnqueueOptions, type Job, JOB_NAME, type JobHandler, JobQueueService, PG_BOSS_TOKEN, POSTGRES_DB } from "@src/core";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";

const RETRY_DELAY_IN_SECONDS = 30;
const RETRY_DELAY_MAX_IN_SECONDS = 5 * 60;
const RETRY_LIMIT = 5;

let jobQueueReady: Promise<{ jobQueue: JobQueueService; pgBoss: PgBoss }> | undefined;

/** pg-boss owns its own schema and creates it on start, so the boss this suite shares is bootstrapped once per file. */
function bootstrapJobQueue() {
  jobQueueReady ??= (async () => {
    const coreConfig = container.resolve(CoreConfigService);
    const pgBoss = new PgBoss({
      connectionString: coreConfig.get("POSTGRES_DB_URI"),
      schema: coreConfig.get("POSTGRES_BACKGROUND_JOBS_SCHEMA"),
      schedule: false
    });
    container.registerInstance(PG_BOSS_TOKEN, pgBoss);

    const jobQueue = container.resolve(JobQueueService);
    await jobQueue.setup();

    return { jobQueue, pgBoss };
  })();

  return jobQueueReady;
}

type QueueRow = {
  name: string;
  policy: string;
  retry_limit: number;
  retry_backoff: boolean;
  retry_delay: number;
  retry_delay_max: number | null;
  created_on: string;
  updated_on: string;
};

type JobRow = {
  state: string;
  retry_limit: number;
  retry_backoff: boolean;
  retry_delay: number;
  retry_delay_max: number | null;
  start_after: string;
};

describe(JobQueueService.name, () => {
  afterAll(async () => {
    if (jobQueueReady) await (await jobQueueReady).jobQueue.dispose();
  });

  it("converges a queue that pg-boss created without a base delay", async () => {
    const { jobQueue, handler, createLegacyQueue, findQueue } = await setup({ queueName: "converging", policy: "singleton" });
    await createLegacyQueue();
    const before = await findQueue();
    expect(before.retry_delay).toBe(0);

    await jobQueue.registerHandlers([handler]);

    const after = await findQueue();
    expect(after).toMatchObject({
      retry_limit: RETRY_LIMIT,
      retry_backoff: true,
      retry_delay: RETRY_DELAY_IN_SECONDS,
      retry_delay_max: RETRY_DELAY_MAX_IN_SECONDS,
      policy: "singleton"
    });
    expect(after.created_on).toEqual(before.created_on);
  });

  it("rewrites a queue created as standard onto the exclusive policy its handler declares, so a second job under one key is refused", async () => {
    const singletonKey = "row-1";
    const { jobQueue, handler, createLegacyQueue, enqueue, findQueue } = await setup({ queueName: "exclusive-late", policy: "exclusive" });
    await createLegacyQueue({ policy: "standard" });

    await jobQueue.registerHandlers([handler]);

    expect((await findQueue()).policy).toBe("exclusive");
    expect(await enqueue({ singletonKey })).toEqual(expect.any(String));
    expect(await enqueue({ singletonKey })).toBeNull();
  });

  it("gives a queue it creates for the first time the same base delay", async () => {
    const { jobQueue, handler, findQueue } = await setup({ queueName: "never-seen" });

    await jobQueue.registerHandlers([handler]);

    expect(await findQueue()).toMatchObject({ retry_delay: RETRY_DELAY_IN_SECONDS, retry_backoff: true });
  });

  it("stops writing to the queue once its settings match", async () => {
    const { jobQueue, handler, createLegacyQueue, findQueue } = await setup({ queueName: "settling" });
    await createLegacyQueue();
    await jobQueue.registerHandlers([handler]);
    const converged = await findQueue();
    expect(converged.retry_delay).toBe(RETRY_DELAY_IN_SECONDS);

    await jobQueue.registerHandlers([handler]);

    expect((await findQueue()).updated_on).toEqual(converged.updated_on);
  });

  it("stamps the converged base delay onto jobs enqueued afterwards", async () => {
    const { jobQueue, handler, createLegacyQueue, enqueue, findJob } = await setup({ queueName: "inheriting" });
    await createLegacyQueue();
    await jobQueue.registerHandlers([handler]);

    await enqueue();

    expect(await findJob()).toMatchObject({
      retry_limit: RETRY_LIMIT,
      retry_backoff: true,
      retry_delay: RETRY_DELAY_IN_SECONDS,
      retry_delay_max: RETRY_DELAY_MAX_IN_SECONDS
    });
  });

  it("pushes a failed job's next attempt into the future instead of running it at once", async () => {
    const { jobQueue, handler, enqueue, findJob } = await setup({ queueName: "backing-off", handle: vi.fn().mockRejectedValue(new Error("boom")) });
    await jobQueue.registerHandlers([handler]);
    await enqueue();

    await jobQueue.startWorkers({ concurrency: 1, pollingIntervalSeconds: 0.5 });

    const retrying = await waitForJobState(findJob, "retry");
    const gap = new Date(retrying.start_after).getTime() - Date.now();
    expect(gap).toBeGreaterThan(secondsToMilliseconds(RETRY_DELAY_IN_SECONDS) * 0.8);
    expect(gap).toBeLessThanOrEqual(secondsToMilliseconds(RETRY_DELAY_IN_SECONDS * 2));
  });

  it("cancels a job that is waiting on a retry", async () => {
    const singletonKey = "owner-1";
    const { jobQueue, handler, enqueue, findJob } = await setup({ queueName: "cancel-retrying", handle: vi.fn().mockRejectedValue(new Error("boom")) });
    await jobQueue.registerHandlers([handler]);
    await enqueue({ singletonKey });
    await jobQueue.startWorkers({ concurrency: 1, pollingIntervalSeconds: 0.5 });
    await waitForJobState(findJob, "retry");

    await jobQueue.cancelCreatedBy({ name: "cancel-retrying", singletonKey });

    expect((await findJob()).state).toBe("cancelled");
  });

  it("reports a job waiting under the key when it is not due before the instant asked about", async () => {
    const singletonKey = "row-1";
    const { jobQueue, handler, enqueue } = await setup({ queueName: "waiting-far" });
    await jobQueue.registerHandlers([handler]);
    await enqueue({ singletonKey, startAfter: addMinutes(new Date(), 1).toISOString() });

    const waiting = await jobQueue.hasWaitingSingleton({ name: "waiting-far", singletonKey, notDueBefore: addSeconds(new Date(), 30) });

    expect(waiting).toBe(true);
  });

  it("leaves out a job under the key that comes due before the instant asked about", async () => {
    const singletonKey = "row-1";
    const { jobQueue, handler, enqueue } = await setup({ queueName: "waiting-soon" });
    await jobQueue.registerHandlers([handler]);
    await enqueue({ singletonKey, startAfter: addMinutes(new Date(), 1).toISOString() });

    const waiting = await jobQueue.hasWaitingSingleton({ name: "waiting-soon", singletonKey, notDueBefore: addMinutes(new Date(), 5) });

    expect(waiting).toBe(false);
  });

  it("leaves out a job under the key once a worker holds it", async () => {
    const singletonKey = "row-1";
    let release!: () => void;
    const held = new Promise<void>(resolve => {
      release = resolve;
    });
    const { jobQueue, handler, enqueue, findJob } = await setup({ queueName: "waiting-active", handle: () => held });
    await jobQueue.registerHandlers([handler]);
    await enqueue({ singletonKey });
    await jobQueue.startWorkers({ concurrency: 1, pollingIntervalSeconds: 0.5 });
    await waitForJobState(findJob, "active");

    const waiting = await jobQueue.hasWaitingSingleton({ name: "waiting-active", singletonKey, notDueBefore: new Date(0) });

    expect(waiting).toBe(false);
    release();
    await waitForJobState(findJob, "completed");
  });

  it("reports a job under the key that is waiting on a retry", async () => {
    const singletonKey = "row-1";
    const { jobQueue, handler, enqueue, findJob } = await setup({ queueName: "waiting-retry", handle: vi.fn().mockRejectedValue(new Error("boom")) });
    await jobQueue.registerHandlers([handler]);
    await enqueue({ singletonKey });
    await jobQueue.startWorkers({ concurrency: 1, pollingIntervalSeconds: 0.5 });
    await waitForJobState(findJob, "retry");

    const waiting = await jobQueue.hasWaitingSingleton({ name: "waiting-retry", singletonKey, notDueBefore: new Date(0) });

    expect(waiting).toBe(true);
  });

  function waitForJobState(findJob: () => Promise<JobRow>, state: string) {
    return vi.waitFor(
      async () => {
        const job = await findJob();
        expect(job.state).toBe(state);
        return job;
      },
      { timeout: 20_000, interval: 250 }
    );
  }

  function backgroundJobsSchema() {
    return sql.identifier(container.resolve(CoreConfigService).get("POSTGRES_BACKGROUND_JOBS_SCHEMA"));
  }

  async function setup(input: { queueName: string; policy?: PgBossQueue["policy"]; handle?: JobHandler<Job>["handle"] }) {
    const { jobQueue, pgBoss } = await bootstrapJobQueue();
    const { queueName, policy } = input;
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);

    class ScopedJob implements Job {
      static readonly [JOB_NAME] = queueName;
      readonly name = queueName;
      readonly version = 1;

      constructor(public readonly data: Record<string, unknown> = {}) {}
    }

    return {
      jobQueue,
      handler: {
        accepts: ScopedJob,
        policy,
        requiresPermission: () => [],
        handle: input.handle ?? vi.fn().mockResolvedValue(undefined)
      } satisfies JobHandler<Job>,
      enqueue: (options?: EnqueueOptions) => jobQueue.enqueue(new ScopedJob(), options),
      createLegacyQueue: (overrides?: { policy?: PgBossQueue["policy"] }) =>
        pgBoss.createQueue(queueName, { retryLimit: RETRY_LIMIT, retryBackoff: true, retryDelayMax: RETRY_DELAY_MAX_IN_SECONDS, policy, ...overrides }),
      findQueue: async () => {
        const rows = await db.execute<QueueRow>(
          sql`select name, policy, retry_limit, retry_backoff, retry_delay, retry_delay_max, created_on::text, updated_on::text
              from ${backgroundJobsSchema()}.queue where name = ${queueName}`
        );

        return (rows as unknown as QueueRow[])[0];
      },
      findJob: async () => {
        const rows = await db.execute<JobRow>(
          sql`select state, retry_limit, retry_backoff, retry_delay, retry_delay_max, start_after::text
              from ${backgroundJobsSchema()}.job where name = ${queueName}`
        );

        return (rows as unknown as JobRow[])[0];
      }
    };
  }
});
