import { sql } from "drizzle-orm";
import { container } from "tsyringe";
import { afterAll, vi } from "vitest";

import { AbilityService } from "@src/auth/services/ability/ability.service";
import type { ApiPgDatabase } from "@src/core";
import { type EnqueueOptions, type Job, type JobHandler, JobQueueService, POSTGRES_DB } from "@src/core";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { UserOutput } from "@src/user/repositories";

const WORKER_OPTIONS = { concurrency: 1, pollingIntervalSeconds: 0.5 };

const SETTLE_TIMEOUT_IN_MS = 20_000;
const SETTLE_INTERVAL_IN_MS = 250;

export interface JobRow<TData = Record<string, unknown>> {
  state: string;
  output: unknown;
  retry_count: number;
  retry_limit: number;
  retry_backoff: boolean;
  retry_delay: number;
  retry_delay_max: number | null;
  singleton_key: string;
  data: TData;
  start_after: string;
}

function db() {
  return container.resolve<ApiPgDatabase>(POSTGRES_DB);
}

function jobTable() {
  return sql`${sql.identifier(container.resolve(CoreConfigService).get("POSTGRES_BACKGROUND_JOBS_SCHEMA"))}.job`;
}

/** Disposes on teardown because a worker left running outlives a test's interceptors and then calls the real chain. */
export function useJobWorkers(resolveHandlers: () => JobHandler<Job>[]) {
  let ready: Promise<JobQueueService> | undefined;

  afterAll(async () => {
    if (ready) await (await ready).dispose();
  });

  return async function jobWorkers() {
    ready ??= (async () => {
      const jobQueue = container.resolve(JobQueueService);
      await jobQueue.setup();
      await jobQueue.registerHandlers(resolveHandlers());

      return jobQueue;
    })();

    const jobQueue = await ready;

    return {
      jobQueue,
      enqueue: (job: Job, options?: EnqueueOptions) => jobQueue.enqueue(job, options),
      startWorkers: () => jobQueue.startWorkers(WORKER_OPTIONS)
    };
  };
}

export async function findJobRows<TData = Record<string, unknown>>(jobName: string, options: { singletonKeyLike?: string } = {}): Promise<JobRow<TData>[]> {
  const singletonKeyFilter = options.singletonKeyLike ? sql`and singleton_key like ${options.singletonKeyLike}` : sql``;
  const rows = await db().execute(
    sql`select state, output, retry_count, retry_limit, retry_backoff, retry_delay, retry_delay_max, singleton_key, data, start_after::text
        from ${jobTable()}
        where name = ${jobName} ${singletonKeyFilter}
        order by created_on`
  );

  return rows as unknown as JobRow<TData>[];
}

function describeFailure(output: unknown) {
  if (output && typeof output === "object" && "message" in output) {
    const { message, stack } = output as { message?: unknown; stack?: unknown };

    return typeof stack === "string" ? stack : String(message);
  }

  return JSON.stringify(output);
}

/** Reports what a job recorded, because pg-boss reschedules a throwing handler silently and a side-effect wait alone times out with no cause. */
export async function expectJobCompleted(jobName: string, options: { timeout?: number; singletonKeyLike?: string } = {}): Promise<JobRow> {
  return await vi.waitFor(
    async () => {
      const [row] = await findJobRows(jobName, options);

      if (!row) throw new Error(`No "${jobName}" job was enqueued`);
      if (row.state === "completed") return row;

      throw new Error(`Job "${jobName}" is ${row.state} instead of completed. It recorded:\n${describeFailure(row.output)}`);
    },
    { timeout: options.timeout ?? SETTLE_TIMEOUT_IN_MS, interval: SETTLE_INTERVAL_IN_MS }
  );
}

export async function makeJobDue(jobName: string, options: { singletonKey?: string } = {}): Promise<void> {
  const singletonKeyFilter = options.singletonKey ? sql`and singleton_key = ${options.singletonKey}` : sql``;

  await db().execute(sql`update ${jobTable()} set start_after = now() where name = ${jobName} ${singletonKeyFilter}`);
}

/** Lets a fixture be built through the ability-scoped services a request uses, which the worker's own empty ability would refuse. */
export async function runAsUser<T>(user: UserOutput, cb: () => Promise<T>): Promise<T> {
  const executionContextService = container.resolve(ExecutionContextService);
  const ability = container.resolve(AbilityService).getAbilityFor("REGULAR_USER", user);

  return await executionContextService.runWithContext(async () => {
    executionContextService.set("CURRENT_USER", user);
    executionContextService.set("ABILITY", ability);

    return await cb();
  });
}
