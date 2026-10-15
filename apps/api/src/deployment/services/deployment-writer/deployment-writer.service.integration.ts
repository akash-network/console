import { createMongoAbility, type MongoAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { minutesToMilliseconds, secondsToMilliseconds } from "date-fns";
import { eq, sql } from "drizzle-orm";
import nock from "nock";
import { randomUUID } from "node:crypto";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import type { ApiPgDatabase, JobPermissions } from "@src/core";
import { JOB_NAME, POSTGRES_DB, resolveTable, TxService } from "@src/core";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import type { DeploymentResponse } from "@src/deployment/http-schemas/deployment.schema";
import {
  DeleteUnbackedDeploymentSetting,
  DeleteUnbackedDeploymentSettingHandler
} from "@src/deployment/services/delete-unbacked-deployment-setting/delete-unbacked-deployment-setting.handler";
import { DeploymentReaderService } from "@src/deployment/services/deployment-reader/deployment-reader.service";
import {
  RecordDeploymentSetting,
  RecordDeploymentSettingHandler
} from "@src/deployment/services/record-deployment-setting/record-deployment-setting.handler";
import { SdlService } from "@src/deployment/services/sdl/sdl.service";
import { SdlSecretsService } from "@src/deployment/services/sdl-secrets/sdl-secrets.service";
import { ProviderService } from "@src/provider/services/provider/provider.service";
import { type AcceptedDeploymentCreate, DeploymentWriterService, type SavedPatch } from "./deployment-writer.service";

import { registerFakeSdlSecretsKms, warmSealingKeyAsBootWould } from "@test/mocks/sdl-secrets-kms.mock";
import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { createDseq, seedDeploymentSetting } from "@test/seeders/db/deployment-setting.seeder";
import { seedOrganizationMember, seedOrganizationWithOwner } from "@test/seeders/db/organization.seeder";
import { seedUser, seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { createUser } from "@test/seeders/user.seeder";
import { expectJobCompleted, findJobRows, type JobRow, makeJobDue, runAsUser, useJobWorkers } from "@test/services/job-queue-harness";

registerFakeSdlSecretsKms();

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

const SAVED_SDL = SDL.replace("image: nginx", "image: nginx\n    env:\n      - API_TOKEN=ac-secret://API_TOKEN");

const LEASE_PROVIDER = "akash1provider";

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

  describe("applySavedPatch", () => {
    it("applies a saved patch as the background user under only the rules a job declares, opening the stored token itself", async () => {
      const { member, saved, secretValue, applyAsBackgroundJob, broadcast, pushManifest } = await setup();

      await applyAsBackgroundJob(saved, personalRulesFor(member.id));

      const [[signingWallet, [update]]] = broadcast.mock.calls;
      expect(signingWallet).toMatchObject({ userId: member.id });
      expect(Buffer.from(update.value.hash).toString("base64")).toBe(saved.manifestVersion);
      expect(pushManifest).toHaveBeenCalledWith(
        expect.objectContaining({ provider: LEASE_PROVIDER, dseq: saved.dseq, manifest: expect.stringContaining(`API_TOKEN=${secretValue}`) })
      );
    });

    it("cannot sign with the wallet of a member the job's rules do not cover", async () => {
      const { saved, applyAsBackgroundJob, broadcast, pushManifest } = await setup();

      await expect(applyAsBackgroundJob(saved, personalRulesFor(randomUUID()))).rejects.toMatchObject({ status: 404, message: "UserWallet Not Found" });
      expect(broadcast).not.toHaveBeenCalled();
      expect(pushManifest).not.toHaveBeenCalled();
    });

    it("cannot read the saved definition of a deployment whose owner the job's rules do not cover", async () => {
      const { member, saved, applyAsBackgroundJob, broadcast, pushManifest } = await setup();
      const rules: JobPermissions = [
        { action: "sign", subject: "UserWallet", conditions: { userId: member.id } },
        { action: "read", subject: "DeploymentSetting", conditions: { userId: randomUUID() } }
      ];

      await expect(applyAsBackgroundJob(saved, rules)).rejects.toMatchObject({
        status: 404,
        message: expect.stringContaining("no SDL recorded by the console")
      });
      expect(broadcast).not.toHaveBeenCalled();
      expect(pushManifest).not.toHaveBeenCalled();
    });

    describe("a patch saved through an organization's wallet", () => {
      it("applies it with the organization's wallet for the member who saved it, opening the token of the member who filed the deployment", async () => {
        const { member, wallet, saved, secretValue, applyAsBackgroundJob, broadcast, pushManifest } = await setup({ owner: "organization" });

        await applyAsBackgroundJob(saved, organizationRulesFor({ walletId: wallet.id, organizationId: wallet.organizationId as string }));

        const [[signingWallet, [update], options]] = broadcast.mock.calls;
        expect(signingWallet).toMatchObject({ id: wallet.id, userId: null, organizationId: wallet.organizationId });
        expect(options).toEqual({ actingUserId: member.id });
        expect(Buffer.from(update.value.hash).toString("base64")).toBe(saved.manifestVersion);
        expect(pushManifest).toHaveBeenCalledWith(
          expect.objectContaining({ provider: LEASE_PROVIDER, dseq: saved.dseq, manifest: expect.stringContaining(`API_TOKEN=${secretValue}`) })
        );
      });

      it("cannot read the saved definition when the job's rules cover another organization's deployments", async () => {
        const { wallet, saved, applyAsBackgroundJob, broadcast, pushManifest } = await setup({ owner: "organization" });

        await expect(applyAsBackgroundJob(saved, organizationRulesFor({ walletId: wallet.id, organizationId: randomUUID() }))).rejects.toMatchObject({
          status: 404,
          message: expect.stringContaining("no SDL recorded by the console")
        });
        expect(broadcast).not.toHaveBeenCalled();
        expect(pushManifest).not.toHaveBeenCalled();
      });

      it("cannot sign with the organization's wallet under the personal rules of the member who saved it", async () => {
        const { member, saved, applyAsBackgroundJob, broadcast, pushManifest } = await setup({ owner: "organization" });

        await expect(applyAsBackgroundJob(saved, personalRulesFor(member.id))).rejects.toMatchObject({ status: 404, message: "UserWallet Not Found" });
        expect(broadcast).not.toHaveBeenCalled();
        expect(pushManifest).not.toHaveBeenCalled();
      });

      it("cannot sign with the organization's wallet when the job's rules name another wallet", async () => {
        const { wallet, saved, applyAsBackgroundJob, broadcast, pushManifest } = await setup({ owner: "organization" });

        await expect(
          applyAsBackgroundJob(saved, organizationRulesFor({ walletId: wallet.id + 1, organizationId: wallet.organizationId as string }))
        ).rejects.toMatchObject({
          status: 404,
          message: "UserWallet Not Found"
        });
        expect(broadcast).not.toHaveBeenCalled();
        expect(pushManifest).not.toHaveBeenCalled();
      });
    });

    function personalRulesFor(userId: string): JobPermissions {
      return [
        { action: "sign", subject: "UserWallet", conditions: { userId } },
        { action: "read", subject: "DeploymentSetting", conditions: { userId } }
      ];
    }

    function organizationRulesFor({ walletId, organizationId }: { walletId: number; organizationId: string }): JobPermissions {
      return [
        { action: "sign", subject: "UserWallet", conditions: { id: walletId } },
        { action: "read", subject: "DeploymentSetting", conditions: { organizationId } }
      ];
    }

    async function setup(input: { owner?: "user" | "organization" } = {}) {
      await jobWorkers();
      await warmSealingKeyAsBootWould();

      const { filer, member, wallet, filedIn, walletOfPatch } = input.owner === "organization" ? await seedOrganizationWallet() : await seedPersonalWallet();
      const dseq = createDseq();
      const secretValue = faker.string.alphanumeric(24);
      const secrets = { API_TOKEN: secretValue };
      const sealedSecrets = await runAsUser(filer, () => container.resolve(SdlSecretsService).sealForStorage({ userId: filer.id, dseq, secrets }));
      const manifestVersion = await savedVersionOf(SAVED_SDL, secrets);
      await seedDeploymentSetting({ userId: filer.id, ...filedIn, dseq, sdl: SAVED_SDL, manifestVersion, sealedSecrets, autoTopUpEnabled: false });

      vi.spyOn(container.resolve(DeploymentReaderService), "findByWalletAndDseqWithoutProviderStatus").mockResolvedValue(
        chainHoldingAnOlderVersion(wallet.address as string, dseq)
      );
      const broadcast = vi
        .spyOn(container.resolve(ManagedSignerService), "executeDecodedTxByUserWallet")
        .mockResolvedValue({ code: 0, hash: "tx-hash", transactionHash: "tx-hash", rawLog: "" });
      const pushManifest = vi.spyOn(container.resolve(ProviderService), "sendManifest").mockResolvedValue(true);
      vi.spyOn(container.resolve(ProviderService), "toProviderAuth").mockResolvedValue({ type: "jwt", token: "provider-token" });

      async function applyAsBackgroundJob(patch: SavedPatch, rules: JobPermissions) {
        const executionContextService = container.resolve(ExecutionContextService);
        const ability = createMongoAbility<MongoAbility>(rules);

        await executionContextService.runWithContext(async () => {
          executionContextService.set("CURRENT_USER", createUser({ id: "bg-job-user", userId: "system:bg-job-user" }));
          executionContextService.set("ABILITY", ability);

          await container.resolve(DeploymentWriterService).applySavedPatch(patch, ability);
        });
      }

      return {
        member,
        wallet,
        saved: { userId: member.id, dseq, manifestVersion, ...walletOfPatch },
        secretValue,
        applyAsBackgroundJob,
        broadcast,
        pushManifest
      };
    }

    async function seedPersonalWallet() {
      const { user, wallet } = await seedUserWithWallet();

      return { filer: user, member: user, wallet, filedIn: {}, walletOfPatch: {} };
    }

    async function seedOrganizationWallet() {
      const { user: filer, organization, project } = await seedOrganizationWithOwner();
      const member = await seedUser();
      await seedOrganizationMember({ organizationId: organization.id, userId: member.id });
      const [wallet] = await container
        .resolve<ApiPgDatabase>(POSTGRES_DB)
        .insert(resolveTable("UserWallets"))
        .values({ userId: null, organizationId: organization.id, createdByUserId: filer.id, address: createAkashAddress(), isTrialing: false })
        .returning();

      return { filer, member, wallet, filedIn: { organizationId: organization.id, projectId: project.id }, walletOfPatch: { walletId: wallet.id } };
    }

    async function savedVersionOf(sdl: string, secrets: Record<string, string>) {
      const resolved = await container.resolve(SdlService).generateResolvedManifest({ sdl, secrets });
      if (!resolved.ok) throw new Error(`The saved sdl does not resolve: ${resolved.value.map(error => error.message).join(", ")}`);

      return Buffer.from(resolved.value.manifestVersion).toString("base64");
    }

    function chainHoldingAnOlderVersion(owner: string, dseq: string): DeploymentResponse {
      return {
        deployment: { id: { owner, dseq }, state: "active", hash: Buffer.from("an older version").toString("base64"), created_at: "1" },
        leases: [
          {
            id: { owner, dseq, gseq: 1, oseq: 1, provider: LEASE_PROVIDER, bseq: 1 },
            state: "active",
            price: { denom: "uakt", amount: "1000" },
            created_at: "1",
            closed_on: "",
            status: null
          }
        ],
        escrow_account: {
          id: { scope: "deployment", xid: dseq },
          state: { owner, state: "open", transferred: [], settled_at: "0", funds: [], deposits: [] }
        }
      };
    }
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
      .spyOn(container.resolve(ManagedSignerService), "executeDecodedTxByUserWallet")
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
