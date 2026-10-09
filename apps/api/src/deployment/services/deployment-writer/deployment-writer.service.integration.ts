import { minutesToMilliseconds, secondsToMilliseconds } from "date-fns";
import { eq, sql } from "drizzle-orm";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import type { ApiPgDatabase } from "@src/core";
import { JOB_NAME, POSTGRES_DB, resolveTable, TxService } from "@src/core";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import {
  DeleteUnbackedDeploymentSetting,
  DeleteUnbackedDeploymentSettingHandler
} from "@src/deployment/services/delete-unbacked-deployment-setting/delete-unbacked-deployment-setting.handler";
import {
  RecordDeploymentSetting,
  RecordDeploymentSettingHandler
} from "@src/deployment/services/record-deployment-setting/record-deployment-setting.handler";
import { type AcceptedDeploymentCreate, DeploymentWriterService } from "./deployment-writer.service";

import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, type JobRow, makeJobDue, runAsUser, useJobWorkers } from "@test/services/job-queue-harness";

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
const RETRY_LIMIT = 47;
const RETRY_DELAY_IN_SECONDS = 30;
const RETRY_DELAY_MAX_IN_SECONDS = 30 * 60;

const DEPLOYMENT_INFO_PATH = "/akash/deployment/v1beta4/deployments/info";
const LATEST_BLOCK_PATH = "/cosmos/base/tendermint/v1beta1/blocks/latest";
const ABSENT_FROM_CHAIN = { code: 5, message: "codespace deployment code 4: Deployment not found", details: [] };

const jobWorkers = useJobWorkers(() => [container.resolve(DeleteUnbackedDeploymentSettingHandler), container.resolve(RecordDeploymentSettingHandler)]);

type CompensationPayload = { deploymentSettingId: string; owner: string; dseq: string; version: number };

type CompensationRow = JobRow<CompensationPayload> & { singleton_key: string };

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

  describe("creating an accepted deployment on chain", () => {
    it("sends a retry the chain holds no deployment for, and retires the compensation it still waits on", async () => {
      const { user, acceptDeployment, createOnChain, answerDeploymentInfoWith, broadcast, findCompensation } = await setup();
      const { accepted } = await acceptDeployment();
      answerDeploymentInfoWith(accepted, 404, ABSENT_FROM_CHAIN);

      await expect(createOnChain(accepted, { retry: true })).resolves.toMatchObject({ transactionHash: "tx-hash" });

      expect(broadcast).toHaveBeenCalledTimes(1);
      expect((await findCompensation(user.id, accepted.dseq)).state).toBe("cancelled");
    });

    it("adopts on a retry the deployment an earlier attempt created, recording it and retiring the compensation without sending it again", async () => {
      const { user, acceptDeployment, createOnChain, answerDeploymentInfoWith, broadcast, findCompensation, findSetting } = await setup();
      const { accepted } = await acceptDeployment();
      const { manifestVersion } = await findSetting(accepted.dseq);
      answerDeploymentInfoWith(accepted, 200, { deployment: { id: { dseq: accepted.dseq }, state: "active", hash: manifestVersion }, groups: [], escrow_account: null });

      await expect(createOnChain(accepted, { retry: true })).resolves.toEqual({ code: 0, hash: "", transactionHash: "", rawLog: "" });

      expect(broadcast).not.toHaveBeenCalled();
      expect((await findCompensation(user.id, accepted.dseq)).state).toBe("cancelled");
      expect(await findJobRows(RecordDeploymentSetting[JOB_NAME], { singletonKey: `recordDeploymentSetting.${user.id}.${accepted.dseq}` })).toHaveLength(1);
    });

    it("sends nothing once the compensation is due to judge the record, leaving the record for it", async () => {
      const { user, acceptDeployment, createOnChain, broadcast, findSetting } = await setup();
      const { accepted } = await acceptDeployment();
      await makeJobDue(DeleteUnbackedDeploymentSetting[JOB_NAME], { singletonKey: `deleteUnbackedDeploymentSetting.${user.id}.${accepted.dseq}` });

      await expect(createOnChain(accepted)).rejects.toMatchObject({ status: 409, errorCode: "deployment_create_expired" });

      expect(broadcast).not.toHaveBeenCalled();
      expect(await findSetting(accepted.dseq)).toBeDefined();
    });

    it("sends nothing once the compensation has deleted the record of a create that never reached the chain", async () => {
      const { user, acceptDeployment, createOnChain, answerDeploymentInfoWith, answerLatestBlockAt, broadcast, findSetting, startWorkers } = await setup();
      const { accepted } = await acceptDeployment();
      const compensationKey = `deleteUnbackedDeploymentSetting.${user.id}.${accepted.dseq}`;
      answerLatestBlockAt(new Date(Date.now() + minutesToMilliseconds(GRACE_IN_MIN)));
      answerDeploymentInfoWith(accepted, 404, ABSENT_FROM_CHAIN);
      await makeJobDue(DeleteUnbackedDeploymentSetting[JOB_NAME], { singletonKey: compensationKey });
      await startWorkers();
      await expectJobCompleted(DeleteUnbackedDeploymentSetting[JOB_NAME], { singletonKey: compensationKey });
      expect(await findSetting(accepted.dseq)).toBeUndefined();

      await expect(createOnChain(accepted, { retry: true })).rejects.toMatchObject({ status: 409, errorCode: "deployment_create_expired" });

      expect(broadcast).not.toHaveBeenCalled();
    });
  });

  function jobTable() {
    return sql`${sql.identifier(container.resolve(CoreConfigService).get("POSTGRES_BACKGROUND_JOBS_SCHEMA"))}.job`;
  }

  async function findCompensations(userId: string): Promise<CompensationRow[]> {
    const rows = await findJobRows<CompensationPayload>(DeleteUnbackedDeploymentSetting[JOB_NAME], { singletonKeyLike: `%.${userId}.%` });

    return rows as CompensationRow[];
  }

  async function setup() {
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const txService = container.resolve(TxService);
    const deploymentSettingsTable = resolveTable("DeploymentSettings");

    const { startWorkers } = await jobWorkers();

    const broadcast = vi
      .spyOn(container.resolve(ManagedSignerService), "executeDerivedDecodedTxByUserId")
      .mockResolvedValue({ code: 0, transactionHash: "tx-hash", hash: "tx-hash", rawLog: "" });
    vi.spyOn(container.resolve(ManagedSignerService), "assertCanBroadcast").mockResolvedValue(undefined);

    const { user, address } = await seedUserWithWallet();
    const restApiNodeUrl = container.resolve(CoreConfigService).get("REST_API_NODE_URL");

    async function findCompensation(userId: string, dseq: string) {
      const rows = await findCompensations(userId);
      const compensation = rows.find(row => row.singleton_key.endsWith(`.${dseq}`));
      expect(compensation).toBeDefined();

      return compensation as CompensationRow;
    }

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

    async function makeCompensationDue(userId: string) {
      const [compensation] = await findCompensations(userId);
      await makeJobDue(DeleteUnbackedDeploymentSetting[JOB_NAME], { singletonKey: compensation.singleton_key });

      return { dseq: compensation.data.dseq };
    }

    function failEveryChainQuery() {
      nock(restApiNodeUrl)
        .persist()
        .get(/.*/)
        .query(true)
        .replyWithError(Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }));
    }

    function answerDeploymentInfoWith({ dseq }: AcceptedDeploymentCreate, status: number, body: nock.Body) {
      nock(restApiNodeUrl).get(DEPLOYMENT_INFO_PATH).query({ "id.owner": address, "id.dseq": dseq }).reply(status, body);
    }

    function answerLatestBlockAt(time: Date) {
      nock(restApiNodeUrl)
        .persist()
        .get(LATEST_BLOCK_PATH)
        .query(true)
        .reply(200, { block_id: {}, block: { header: { height: "28343549", time: time.toISOString(), chain_id: "akashnet-2" } } });
    }

    const writer = container.resolve(DeploymentWriterService);

    async function createDeployment() {
      return await runAsUser(user, () => writer.create({ userId: user.id, sdl: SDL, deposit: 5 }));
    }

    async function acceptDeployment() {
      return await runAsUser(user, () => writer.acceptCreate({ userId: user.id, sdl: SDL }));
    }

    async function createOnChain(accepted: AcceptedDeploymentCreate, options?: { retry?: boolean }) {
      return await runAsUser(user, () => writer.createOnChain(accepted, options));
    }

    return {
      createDeployment,
      acceptDeployment,
      createOnChain,
      answerDeploymentInfoWith,
      answerLatestBlockAt,
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
      startWorkers,
      countSettings,
      countCompensations
    };
  }
});
