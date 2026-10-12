import "@src/app/providers/jobs.provider";

import createError from "http-errors";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, type MockInstance, vi } from "vitest";

import { ActivityRepository } from "@src/activity/repositories/activity/activity.repository";
import { TxOutcomeUnknownError } from "@src/billing/services/external-signer-http-sdk/tx-outcome.error";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { type EnqueueOptions, JOB_NAME, JobQueueService } from "@src/core";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import {
  DeleteUnbackedDeploymentSetting,
  DeleteUnbackedDeploymentSettingHandler
} from "@src/deployment/services/delete-unbacked-deployment-setting/delete-unbacked-deployment-setting.handler";
import { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import { ReconcileDeploymentCreateHandler } from "@src/deployment/services/reconcile-deployment-create/reconcile-deployment-create.handler";
import { ReconcileDeploymentCreate } from "@src/deployment/services/reconcile-deployment-create/reconcile-deployment-create.job";
import { RecordDeploymentSettingHandler } from "@src/deployment/services/record-deployment-setting/record-deployment-setting.handler";
import { CreateDeploymentHandler } from "./create-deployment.handler";
import { CREATE_DEPLOYMENT_RETRY_OPTIONS, CreateDeployment, createDeploymentKeyFor } from "./create-deployment.job";

import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, runAsUser, useJobWorkers } from "@test/services/job-queue-harness";

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

const DEPLOYMENT_INFO_PATH = "/akash/deployment/v1beta4/deployments/info";

const jobWorkers = useJobWorkers(() => [
  container.resolve(CreateDeploymentHandler),
  container.resolve(ReconcileDeploymentCreateHandler),
  container.resolve(DeleteUnbackedDeploymentSettingHandler),
  container.resolve(RecordDeploymentSettingHandler)
]);

describe(CreateDeploymentHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  describe("queued by a background create", () => {
    it("is queued with the accepted create, a pending activity and a later check on it", async () => {
      const { user, createInBackground, findActivities } = await setup();

      const { dseq, activityId } = await createInBackground();

      expect(await findActivities()).toEqual([expect.objectContaining({ id: activityId, type: "deployment_create", meta: { dseq } })]);
      const [createJob] = await findJobRows(CreateDeployment[JOB_NAME], { singletonKey: createDeploymentKeyFor({ userId: user.id, dseq }) });
      expect(createJob.data).toEqual({ userId: user.id, dseq, message: expect.any(String), activityId, version: 1 });
      const [check] = await findJobRows<{ createJobId: string }>(ReconcileDeploymentCreate[JOB_NAME], { data: { activityId } });
      expect(check).toMatchObject({ state: "created", data: { userId: user.id, dseq, activityId, createJobId: expect.any(String) } });
      expect(await container.resolve(JobQueueService).findJob(CreateDeployment, check.data.createJobId)).toBeDefined();
    });

    it("leaves neither the activity nor the create queued when the transaction they share fails", async () => {
      const { user, createInBackground, findActivities } = await setup();
      const jobQueueService = container.resolve(JobQueueService);
      const enqueue = jobQueueService.enqueue.bind(jobQueueService);
      vi.spyOn(jobQueueService, "enqueue").mockImplementation(async (job, options) => {
        if (job instanceof ReconcileDeploymentCreate) throw new Error("connection terminated");
        return await enqueue(job, options);
      });

      await expect(createInBackground()).rejects.toThrow("connection terminated");

      expect(await findActivities()).toEqual([]);
      expect(await findJobRows(CreateDeployment[JOB_NAME], { singletonKeyLike: `createDeployment.${user.id}.%` })).toEqual([]);
    });
  });

  describe("run the way a worker runs it", () => {
    it("creates the deployment with the user's wallet and records the create as succeeded", async () => {
      const { user, queueCreate, broadcast, findActivity, findCompensation } = await setup();

      const { accepted, activityId } = await queueCreate();

      await expectJobCompleted(CreateDeployment[JOB_NAME], { singletonKey: createDeploymentKeyFor(accepted) });
      expect(sendsFor(broadcast, user.id)).toEqual([[user.id, [expect.objectContaining({ typeUrl: "/akash.deployment.v1beta4.MsgCreateDeployment" })]]]);
      expect(await findActivity(activityId)).toMatchObject({ status: "succeeded", meta: { dseq: accepted.dseq } });
      expect((await findCompensation(accepted.dseq)).state).toBe("cancelled");
    });

    it("adopts on a retry the deployment an undecided attempt created, without sending it again", async () => {
      const { user, queueCreate, broadcast, answerDeploymentAtRecordedVersion, findActivity, findCompensation } = await setup();
      broadcast.mockRejectedValue(new TxOutcomeUnknownError("ABCDEF"));

      const { accepted, activityId } = await queueCreate({ retryLimit: 2, retryDelay: 1 }, answerDeploymentAtRecordedVersion);

      await expectJobCompleted(CreateDeployment[JOB_NAME], { singletonKey: createDeploymentKeyFor(accepted) });
      expect(sendsFor(broadcast, user.id)).toHaveLength(1);
      expect(await findActivity(activityId)).toMatchObject({ status: "succeeded", meta: { dseq: accepted.dseq } });
      expect((await findCompensation(accepted.dseq)).state).toBe("cancelled");
    });

    it("records a create refused on its first attempt as failed with its reason, without waiting for the retries", async () => {
      const { queueCreate, broadcast, findActivity, waitForJobIn } = await setup();
      broadcast.mockRejectedValue(createError(402, "Not enough balance to cover the deployment deposit."));

      const { accepted, activityId } = await queueCreate({ retryLimit: 3, retryDelay: 3600 });

      await waitForJobIn(accepted, "retry");
      expect(await findActivity(activityId)).toMatchObject({
        status: "failed",
        meta: { error: { code: "create_failed", message: "Not enough balance to cover the deployment deposit." } }
      });
    });

    it("keeps the activity pending while the create still has retries to come", async () => {
      const { queueCreate, broadcast, findActivity, waitForJobIn } = await setup();
      broadcast.mockRejectedValue(new Error("signer unreachable"));

      const { accepted, activityId } = await queueCreate({ retryLimit: 3, retryDelay: 3600 });

      await waitForJobIn(accepted, "retry");
      expect(await findActivity(activityId)).toMatchObject({ status: "pending" });
    });

    it("records the create as failed once the last attempt fails", async () => {
      const { queueCreate, broadcast, findActivity, waitForJobIn } = await setup();
      broadcast.mockRejectedValue(new Error("signer unreachable"));

      const { accepted, activityId } = await queueCreate({ retryLimit: 0 });

      await waitForJobIn(accepted, "failed");
      expect(await findActivity(activityId)).toMatchObject({ status: "failed", meta: { error: { code: "create_failed" } } });
    });
  });

  function sendsFor(broadcast: MockInstance<ManagedSignerService["executeDerivedDecodedTxByUserId"]>, userId: string) {
    return broadcast.mock.calls.filter(([sentFor]) => sentFor === userId);
  }

  async function setup() {
    const { enqueue, startWorkers } = await jobWorkers();
    const activityRepository = container.resolve(ActivityRepository);
    const deploymentSettingRepository = container.resolve(DeploymentSettingRepository);
    const writer = container.resolve(DeploymentWriterService);
    const restApiNodeUrl = container.resolve(CoreConfigService).get("REST_API_NODE_URL");
    const { user, address } = await seedUserWithWallet();

    const broadcast = vi
      .spyOn(container.resolve(ManagedSignerService), "executeDerivedDecodedTxByUserId")
      .mockResolvedValue({ code: 0, transactionHash: "tx-hash", hash: "tx-hash", rawLog: "" });
    vi.spyOn(container.resolve(ManagedSignerService), "assertCanBroadcast").mockResolvedValue(undefined);

    async function answerDeploymentAtRecordedVersion(dseq: string) {
      const setting = await deploymentSettingRepository.findOneBy({ userId: user.id, dseq });
      nock(restApiNodeUrl)
        .persist()
        .get(DEPLOYMENT_INFO_PATH)
        .query({ "id.owner": address, "id.dseq": dseq })
        .reply(200, { deployment: { id: { owner: address, dseq }, state: "active", hash: setting!.manifestVersion }, groups: [], escrow_account: null });
    }

    async function queueCreate(retryOverrides: EnqueueOptions = {}, beforeWorkersStart: (dseq: string) => Promise<void> = async () => undefined) {
      const { accepted } = await runAsUser(user, () => writer.acceptCreate({ userId: user.id, sdl: SDL }));
      const activity = await activityRepository.create({ userId: user.id, type: "deployment_create", status: "pending", meta: { dseq: accepted.dseq } });
      await beforeWorkersStart(accepted.dseq);
      await enqueue(new CreateDeployment({ ...accepted, activityId: activity.id }), {
        singletonKey: createDeploymentKeyFor(accepted),
        ...CREATE_DEPLOYMENT_RETRY_OPTIONS,
        ...retryOverrides
      });
      await startWorkers();

      return { accepted, activityId: activity.id };
    }

    return {
      user,
      broadcast,
      queueCreate,
      answerDeploymentAtRecordedVersion,
      createInBackground: async () => await runAsUser(user, () => writer.createInBackground({ userId: user.id, sdl: SDL })),
      findActivities: async () => await activityRepository.find({ userId: user.id }),
      findActivity: async (id: string) => await activityRepository.findById(id),
      findCompensation: async (dseq: string) => {
        const [compensation] = await findJobRows(DeleteUnbackedDeploymentSetting[JOB_NAME], { singletonKey: `deleteUnbackedDeploymentSetting.${user.id}.${dseq}` });
        return compensation;
      },
      waitForJobIn: async (accepted: { userId: string; dseq: string }, state: "failed" | "retry") =>
        await vi.waitFor(
          async () => {
            const [row] = await findJobRows(CreateDeployment[JOB_NAME], { singletonKey: createDeploymentKeyFor(accepted) });
            expect(row?.state).toBe(state);
          },
          { timeout: 15_000, interval: 100 }
        )
    };
  }
});
