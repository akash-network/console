import { minutesToMilliseconds, secondsToMilliseconds } from "date-fns";
import { eq, sql } from "drizzle-orm";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AbilityService } from "@src/auth/services/ability/ability.service";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import type { ApiPgDatabase } from "@src/core";
import { JOB_NAME, JobQueueService, POSTGRES_DB, resolveTable, TxService } from "@src/core";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import {
  DeleteUnbackedDeploymentSetting,
  DeleteUnbackedDeploymentSettingHandler
} from "@src/deployment/services/delete-unbacked-deployment-setting/delete-unbacked-deployment-setting.handler";
import { UserRepository } from "@src/user/repositories";
import { DeploymentWriterService } from "./deployment-writer.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

const SDL = `version: "2.0"
services:
  web:
    image: nginx
    expose:
      - port: 80
        as: 80
        to:
          - global: true
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          - size: 512Mi
  placement:
    dcloud:
      pricing:
        web:
          denom: uakt
          amount: 1000
deployment:
  web:
    dcloud:
      profile: web
      count: 1`;

const GRACE_IN_MIN = 60;
const RETRY_LIMIT = 48;
const RETRY_DELAY_IN_SECONDS = 30;
const RETRY_DELAY_MAX_IN_SECONDS = 30 * 60;

let jobQueueReady: Promise<JobQueueService> | undefined;

/** pg-boss owns its own schema and creates it on start, so the queue this suite enqueues onto is bootstrapped once per file. */
function bootstrapJobQueue() {
  jobQueueReady ??= (async () => {
    const jobQueue = container.resolve(JobQueueService);
    await jobQueue.setup();
    await jobQueue.registerHandlers([container.resolve(DeleteUnbackedDeploymentSettingHandler)]);

    return jobQueue;
  })();

  return jobQueueReady;
}

type CompensationRow = {
  state: string;
  singleton_key: string;
  data: { deploymentSettingId: string; owner: string; dseq: string; version: number };
  retry_limit: number;
  retry_backoff: boolean;
  retry_delay: number;
  retry_delay_max: number | null;
  start_after: string;
};

/**
 * Covers the outbox itself: that the setting row and the compensation that can find it again are one write,
 * and that a create which reaches the chain retires its own compensation. Both are properties of the database,
 * not of the service's control flow, so they are asserted against real Postgres and a real pg-boss schema.
 * Broadcasting is stubbed at the signer boundary because signing has its own tests.
 */
describe(DeploymentWriterService.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  it("enqueues a compensation for the setting it records", async () => {
    const { user, createDeployment, findCompensation } = await setup();

    const { dseq } = await createDeployment();

    const compensation = await findCompensation(user.id, dseq);
    expect(compensation.data).toMatchObject({ dseq, version: 1 });
    expect(compensation.singleton_key).toBe(`deleteUnbackedDeploymentSetting.${user.id}.${dseq}`);
  });

  it("points the compensation at the very row the create wrote", async () => {
    const { user, createDeployment, findCompensation, findSetting } = await setup();

    const { dseq } = await createDeployment();

    const [compensation, setting] = await Promise.all([findCompensation(user.id, dseq), findSetting(dseq)]);
    expect(compensation.data.deploymentSettingId).toBe(setting.id);
  });

  it("writes the setting and its compensation in one transaction", async () => {
    const { user, createDeployment, findCompensations, findCompensationTransactionId, findSettingTransactionId, broadcast } = await setup();
    broadcast.mockRejectedValue(new Error("tx failed"));

    await expect(createDeployment()).rejects.toThrow("tx failed");

    const [{ data }] = await findCompensations(user.id);
    const [compensationTransactionId, settingTransactionId] = await Promise.all([
      findCompensationTransactionId(user.id, data.dseq),
      findSettingTransactionId(data.dseq)
    ]);
    expect(compensationTransactionId).toBe(settingTransactionId);
  });

  it("writes neither the setting nor its compensation when the surrounding transaction rolls back", async () => {
    const { createDeployment, txService, countSettings, countCompensations } = await setup();

    await expect(
      txService.transaction(async () => {
        await createDeployment();
        throw new Error("rolled back");
      })
    ).rejects.toThrow("rolled back");

    expect(await countSettings()).toBe(0);
    expect(await countCompensations()).toBe(0);
  });

  it("cancels the compensation once the create tx is broadcast", async () => {
    const { user, createDeployment, findCompensation } = await setup();

    const { dseq } = await createDeployment();

    expect((await findCompensation(user.id, dseq)).state).toBe("cancelled");
  });

  it("leaves the compensation ready to run when the create tx fails to broadcast", async () => {
    const { user, createDeployment, findCompensations, broadcast } = await setup();
    broadcast.mockRejectedValue(new Error("tx failed"));

    await expect(createDeployment()).rejects.toThrow("tx failed");

    const [compensation] = await findCompensations(user.id);
    expect(compensation.state).toBe("created");
  });

  it("holds the compensation back by the grace a create is given to reach the chain", async () => {
    const { user, createDeployment, findCompensation } = await setup();
    const enqueuedAt = Date.now();

    const { dseq } = await createDeployment();

    const { start_after } = await findCompensation(user.id, dseq);
    const delay = new Date(start_after).getTime() - enqueuedAt;
    expect(delay).toBeGreaterThanOrEqual(minutesToMilliseconds(GRACE_IN_MIN) - 1000);
    expect(delay).toBeLessThanOrEqual(minutesToMilliseconds(GRACE_IN_MIN) + 5000);
  });

  it("stores a retry horizon on the compensation itself, rather than inheriting the queue's", async () => {
    const { user, createDeployment, findCompensation } = await setup();

    const { dseq } = await createDeployment();

    expect(await findCompensation(user.id, dseq)).toMatchObject({
      retry_limit: RETRY_LIMIT,
      retry_backoff: true,
      retry_delay: RETRY_DELAY_IN_SECONDS,
      retry_delay_max: RETRY_DELAY_MAX_IN_SECONDS
    });
  });

  /**
   * The columns above are settings; this is the behaviour they exist to produce. pg-boss multiplies its
   * backoff by `retry_delay`, whose queue default is 0, so a horizon that sets only the limit and the cap
   * stores three convincing values and still reschedules every attempt at `now()` — 48 of them back to back,
   * dead in about a minute. Only an assertion on the rescheduled time can tell the two apart.
   */
  it("pushes the next attempt into the future after one that failed", async () => {
    const { user, createDeployment, findCompensation, makeCompensationDue, failEveryChainQuery, startWorkers, broadcast } = await setup();
    broadcast.mockRejectedValue(new Error("tx failed"));
    failEveryChainQuery();

    await expect(createDeployment()).rejects.toThrow("tx failed");
    const { dseq } = await makeCompensationDue(user.id);
    await startWorkers();

    const rescheduled = await vi.waitFor(
      async () => {
        const compensation = await findCompensation(user.id, dseq);
        expect(compensation.state).toBe("retry");

        return compensation;
      },
      { timeout: 30_000, interval: 250 }
    );

    const gap = new Date(rescheduled.start_after).getTime() - Date.now();
    expect(gap).toBeGreaterThan(secondsToMilliseconds(RETRY_DELAY_IN_SECONDS) * 0.8);
    expect(gap).toBeLessThanOrEqual(secondsToMilliseconds(RETRY_DELAY_MAX_IN_SECONDS));
  });

  /** pg-boss owns its schema, so the app's configured name is the only correct way to reach its tables. */
  function jobTable() {
    return sql`${sql.identifier(container.resolve(CoreConfigService).get("POSTGRES_BACKGROUND_JOBS_SCHEMA"))}.job`;
  }

  async function findCompensations(userId: string): Promise<CompensationRow[]> {
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const rows = await db.execute<CompensationRow>(
      sql`select state, singleton_key, data, retry_limit, retry_backoff, retry_delay, retry_delay_max, start_after
          from ${jobTable()}
          where name = ${DeleteUnbackedDeploymentSetting[JOB_NAME]} and singleton_key like ${`%.${userId}.%`}`
    );

    return rows as unknown as CompensationRow[];
  }

  async function setup() {
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const txService = container.resolve(TxService);
    const userRepository = container.resolve(UserRepository);
    const deploymentSettingsTable = resolveTable("DeploymentSettings");
    const userWalletsTable = resolveTable("UserWallets");

    const jobQueue = await bootstrapJobQueue();

    const broadcast = vi
      .spyOn(container.resolve(ManagedSignerService), "executeDerivedDecodedTxByUserId")
      .mockResolvedValue({ code: 0, transactionHash: "tx-hash", hash: "tx-hash", rawLog: "" });

    const user = await userRepository.create({});
    await db
      .insert(userWalletsTable)
      .values({ userId: user.id, address: createAkashAddress(), deploymentAllowance: "10000000", feeAllowance: "5000000", isTrialing: false })
      .returning();

    async function findCompensation(userId: string, dseq: string) {
      const rows = await findCompensations(userId);
      const compensation = rows.find(row => row.singleton_key.endsWith(`.${dseq}`));
      expect(compensation).toBeDefined();

      return compensation as CompensationRow;
    }

    /**
     * The id of the transaction that inserted the row. Two rows sharing one is the only direct evidence that
     * a single transaction wrote both, and the only assertion that fails if the compensation is enqueued
     * beside the setting's transaction rather than inside it.
     */
    async function findSettingTransactionId(dseq: string) {
      const [row] = (await db.execute(sql`select xmin::text as transaction_id from deployment_settings where dseq = ${dseq}`)) as unknown as {
        transaction_id: string;
      }[];

      return row.transaction_id;
    }

    async function findCompensationTransactionId(userId: string, dseq: string) {
      const [row] = (await db.execute(
        sql`select xmin::text as transaction_id from ${jobTable()} where singleton_key = ${`deleteUnbackedDeploymentSetting.${userId}.${dseq}`}`
      )) as unknown as { transaction_id: string }[];

      return row.transaction_id;
    }

    async function findSetting(dseq: string) {
      const [setting] = await db.select().from(deploymentSettingsTable).where(eq(deploymentSettingsTable.dseq, dseq));

      return setting;
    }

    async function countSettings() {
      const rows = await db.select().from(deploymentSettingsTable).where(eq(deploymentSettingsTable.userId, user.id));

      return rows.length;
    }

    async function countCompensations() {
      return (await findCompensations(user.id)).length;
    }

    /** Brings the grace period forward so a worker will pick the compensation up now instead of in an hour. */
    async function makeCompensationDue(userId: string) {
      const [compensation] = await findCompensations(userId);
      await db.execute(sql`update ${jobTable()} set start_after = now() where singleton_key = ${compensation.singleton_key}`);

      return { dseq: compensation.data.dseq };
    }

    /** Makes the compensation's very first chain query fail, so the attempt fails for a reason a retry could fix. */
    function failEveryChainQuery() {
      nock(container.resolve(CoreConfigService).get("REST_API_NODE_URL"))
        .persist()
        .get(/.*/)
        .query(true)
        .replyWithError(Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }));
    }

    const writer = container.resolve(DeploymentWriterService);
    const executionContextService = container.resolve(ExecutionContextService);
    const ability = container.resolve(AbilityService).getAbilityFor("REGULAR_USER", user);

    /** Creating is a request-path operation: it reads the caller's wallet through the ability the request carries. */
    async function createDeployment() {
      return await executionContextService.runWithContext(async () => {
        executionContextService.set("CURRENT_USER", user);
        executionContextService.set("ABILITY", ability);

        return await writer.create({ userId: user.id, sdl: SDL, deposit: 5 });
      });
    }

    return {
      createDeployment,
      findCompensations,
      txService,
      user,
      broadcast,
      findCompensation,
      findSetting,
      findSettingTransactionId,
      findCompensationTransactionId,
      makeCompensationDue,
      failEveryChainQuery,
      startWorkers: () => jobQueue.startWorkers({ concurrency: 1, pollingIntervalSeconds: 0.5 }),
      countSettings,
      countCompensations
    };
  }
});
