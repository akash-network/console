import "@src/app/providers/jobs.provider";

import { eq } from "drizzle-orm";
import createError from "http-errors";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, type MockInstance, vi } from "vitest";

import { ActivityRepository } from "@src/activity/repositories/activity/activity.repository";
import { AbilityService } from "@src/auth/services/ability/ability.service";
import { TxOutcomeUnknownError } from "@src/billing/services/external-signer-http-sdk/tx-outcome.error";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { DenomExchangeService } from "@src/chain/services/denom-exchange/denom-exchange.service";
import { type ApiPgDatabase, type EnqueueOptions, JOB_NAME, JobQueueService, POSTGRES_DB, resolveTable } from "@src/core";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import {
  DeleteUnbackedDeploymentSetting,
  DeleteUnbackedDeploymentSettingHandler
} from "@src/deployment/services/delete-unbacked-deployment-setting/delete-unbacked-deployment-setting.handler";
import { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import { ACCESS_REVOKED_ERROR_CODE } from "@src/deployment/services/member-deployment-access/member-deployment-access.service";
import { ReconcileDeploymentCreateHandler } from "@src/deployment/services/reconcile-deployment-create/reconcile-deployment-create.handler";
import { ReconcileDeploymentCreate } from "@src/deployment/services/reconcile-deployment-create/reconcile-deployment-create.job";
import { RecordDeploymentSettingHandler } from "@src/deployment/services/record-deployment-setting/record-deployment-setting.handler";
import { creatingActivityOf } from "@src/deployment/utils/create-activity/create-activity";
import { OrganizationContextResolver } from "@src/organization/services/organization-context/organization-context.resolver";
import type { UserOutput } from "@src/user/repositories";
import { CreateDeploymentHandler } from "./create-deployment.handler";
import { CREATE_DEPLOYMENT_RETRY_OPTIONS, CreateDeployment, createDeploymentKeyFor } from "./create-deployment.job";

import { seedOrganizationMember, seedOrganizationWithOwner, seedProject, seedProjectMember } from "@test/seeders/db/organization.seeder";
import { seedOrganizationWallet, seedUser, seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
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

const ACCESS_REVOKED = { code: ACCESS_REVOKED_ERROR_CODE, message: "You no longer have access to this deployment." };

type Revocation = "membership" | "projectGrant" | "role" | "team";

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
      const { user, wallet, createInBackground, findActivities } = await setup();

      const { dseq, activityId } = await createInBackground();

      expect(await findActivities()).toEqual([expect.objectContaining({ id: activityId, type: "deployment_create", initiator: "user", meta: { dseq } })]);
      const [createJob] = await findJobRows(CreateDeployment[JOB_NAME], { singletonKey: createDeploymentKeyFor({ walletId: wallet.id, dseq }) });
      expect(createJob.data).toEqual({ userId: user.id, walletId: wallet.id, dseq, message: expect.any(String), activityId, version: 1 });
      const [check] = await findJobRows<{ createJobId: string }>(ReconcileDeploymentCreate[JOB_NAME], { data: { activityId } });
      expect(check).toMatchObject({ state: "created", data: { userId: user.id, walletId: wallet.id, dseq, activityId, createJobId: expect.any(String) } });
      expect(await container.resolve(JobQueueService).findJob(CreateDeployment, check.data.createJobId)).toBeDefined();
    });

    it("leaves neither the activity nor the create queued when the transaction they share fails", async () => {
      const { wallet, createInBackground, findActivities } = await setup();
      const jobQueueService = container.resolve(JobQueueService);
      const enqueue = jobQueueService.enqueue.bind(jobQueueService);
      vi.spyOn(jobQueueService, "enqueue").mockImplementation(async (job, options) => {
        if (job instanceof ReconcileDeploymentCreate) throw new Error("connection terminated");
        return await enqueue(job, options);
      });

      await expect(createInBackground()).rejects.toThrow("connection terminated");

      expect(await findActivities()).toEqual([]);
      expect(await findJobRows(CreateDeployment[JOB_NAME], { singletonKeyLike: `createDeployment.${wallet.id}.%` })).toEqual([]);
    });
  });

  describe("run the way a worker runs it", () => {
    it("creates the deployment with the wallet the request resolved and records the create as succeeded", async () => {
      const { user, wallet, queueCreate, broadcast, findActivity, findCompensation } = await setup();

      const { accepted, activityId } = await queueCreate();

      await expectJobCompleted(CreateDeployment[JOB_NAME], { singletonKey: createDeploymentKeyFor(accepted) });
      expect(sendsFor(broadcast, wallet.id)).toEqual([
        [
          expect.objectContaining({ id: wallet.id, address: wallet.address }),
          [expect.objectContaining({ typeUrl: "/akash.deployment.v1beta4.MsgCreateDeployment" })],
          { actingUserId: user.id }
        ]
      ]);
      expect(await findActivity(activityId)).toMatchObject({ status: "succeeded", meta: { dseq: accepted.dseq } });
      expect((await findCompensation(accepted.dseq)).state).toBe("cancelled");
    });

    it("adopts on a retry the deployment an undecided attempt created, without sending it again", async () => {
      const { wallet, queueCreate, broadcast, answerDeploymentAtRecordedVersion, findActivity, findCompensation } = await setup();
      broadcast.mockRejectedValue(new TxOutcomeUnknownError("ABCDEF"));

      const { accepted, activityId } = await queueCreate({ retryLimit: 2, retryDelay: 1 }, answerDeploymentAtRecordedVersion);

      await expectJobCompleted(CreateDeployment[JOB_NAME], { singletonKey: createDeploymentKeyFor(accepted) });
      expect(sendsFor(broadcast, wallet.id)).toHaveLength(1);
      expect(await findActivity(activityId)).toMatchObject({ status: "succeeded", meta: { dseq: accepted.dseq } });
      expect((await findCompensation(accepted.dseq)).state).toBe("cancelled");
    });

    it("records a create refused on its first attempt as failed with its reason and ends the job without a retry", async () => {
      const { wallet, queueCreate, broadcast, findActivity } = await setup();
      broadcast.mockRejectedValue(createError(402, "Not enough balance to cover the deployment deposit."));

      const { accepted, activityId } = await queueCreate({ retryLimit: 3, retryDelay: 3600 });

      await expectJobCompleted(CreateDeployment[JOB_NAME], { singletonKey: createDeploymentKeyFor(accepted) });
      expect(sendsFor(broadcast, wallet.id)).toHaveLength(1);
      expect(await findActivity(activityId)).toMatchObject({
        status: "failed",
        meta: { error: { code: "create_failed", message: "Not enough balance to cover the deployment deposit." } }
      });
    });

    it("creates a team deployment with the team wallet for a member who still has access to its project", async () => {
      const { wallet, queueCreate, broadcast, findActivity } = await setup({ inTeam: true });

      const { accepted, activityId } = await queueCreate();

      await expectJobCompleted(CreateDeployment[JOB_NAME], { singletonKey: createDeploymentKeyFor(accepted) });
      expect(accepted.walletId).toBe(wallet.id);
      expect(sendsFor(broadcast, wallet.id)).toHaveLength(1);
      expect(await findActivity(activityId)).toMatchObject({ status: "succeeded" });
    });

    it.each([
      { change: "was removed from the team", revoke: "membership" },
      { change: "lost access to the deployment's project", revoke: "projectGrant" },
      { change: "became a viewer of the team", revoke: "role" },
      { change: "saw the team deleted", revoke: "team" }
    ] as const)("signs nothing and records the create as failed without a retry for a member who $change since it was queued", async ({ revoke }) => {
      const { wallet, queueCreate, broadcast, findActivity } = await setup({ inTeam: true });

      const { accepted, activityId } = await queueCreate({ retryLimit: 3, retryDelay: 3600 }, async () => {
        await revokeAccess(revoke);
      });

      await expectJobCompleted(CreateDeployment[JOB_NAME], { singletonKey: createDeploymentKeyFor(accepted) });
      expect(sendsFor(broadcast, wallet.id)).toEqual([]);
      expect(await findActivity(activityId)).toMatchObject({ status: "failed", meta: { error: ACCESS_REVOKED } });
    });

    it("records as created a team deployment an earlier attempt landed, even for a member removed from the team since", async () => {
      const { wallet, queueCreate, broadcast, answerDeploymentAtRecordedVersion, findActivity } = await setup({ inTeam: true });
      broadcast.mockImplementationOnce(async () => {
        await revokeAccess("membership");
        throw new TxOutcomeUnknownError("ABCDEF");
      });

      const { accepted, activityId } = await queueCreate({ retryLimit: 2, retryDelay: 1 }, answerDeploymentAtRecordedVersion);

      await expectJobCompleted(CreateDeployment[JOB_NAME], { singletonKey: createDeploymentKeyFor(accepted) });
      expect(sendsFor(broadcast, wallet.id)).toHaveLength(1);
      expect(await findActivity(activityId)).toMatchObject({ status: "succeeded" });
    });

    it("keeps the activity pending while the create still has retries to come", async () => {
      const { queueCreate, broadcast, findActivity, waitForJobIn } = await setup();
      broadcast.mockRejectedValue(new Error("signer unreachable"));

      const { accepted, activityId } = await queueCreate({ retryLimit: 3, retryDelay: 3600 });

      await waitForJobIn(accepted, "retry");
      expect(await findActivity(activityId)).toMatchObject({ status: "pending" });
    });

    it("records the create as failed with its reason once a last retry is refused", async () => {
      const { queueCreate, broadcast, answerDeploymentAbsent, findActivity, waitForJobIn } = await setup();
      broadcast
        .mockRejectedValueOnce(new Error("signer unreachable"))
        .mockRejectedValue(createError(402, "Not enough balance to cover the deployment deposit."));

      const { accepted, activityId } = await queueCreate({ retryLimit: 1, retryDelay: 1 }, answerDeploymentAbsent);

      await waitForJobIn(accepted, "failed");
      expect(await findActivity(activityId)).toMatchObject({
        status: "failed",
        meta: { error: { code: "create_failed", message: "Not enough balance to cover the deployment deposit." } }
      });
    });

    it("leaves the create pending for its check once the last attempt fails for a reason only the chain can settle", async () => {
      const { queueCreate, broadcast, findActivity, waitForJobIn } = await setup();
      broadcast.mockRejectedValue(new Error("signer unreachable"));

      const { accepted, activityId } = await queueCreate({ retryLimit: 0 });

      await waitForJobIn(accepted, "failed");
      expect(await findActivity(activityId)).toMatchObject({ status: "pending", meta: { dseq: accepted.dseq } });
    });
  });

  function sendsFor(broadcast: MockInstance<ManagedSignerService["executeDecodedTxByUserWallet"]>, walletId: number) {
    return broadcast.mock.calls.filter(([signingWallet]) => signingWallet.id === walletId);
  }

  let revokeAccess: (revocation: Revocation) => Promise<unknown>;

  async function setup(input: { inTeam?: boolean } = {}) {
    vi.spyOn(container.resolve(FeatureFlagsService), "isEnabled").mockImplementation(flag => flag !== FeatureFlags.ORGANIZATIONS_ENFORCE);
    const { enqueue, startWorkers } = await jobWorkers();
    const activityRepository = container.resolve(ActivityRepository);
    const deploymentSettingRepository = container.resolve(DeploymentSettingRepository);
    const writer = container.resolve(DeploymentWriterService);
    const restApiNodeUrl = container.resolve(CoreConfigService).get("REST_API_NODE_URL");
    const { user, wallet, address, projectId, runAsCaller } = input.inTeam ? await seedTeamMember() : await seedPersonalCaller();

    const broadcast = vi
      .spyOn(container.resolve(ManagedSignerService), "executeDecodedTxByUserWallet")
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

    async function answerDeploymentAbsent(dseq: string) {
      nock(restApiNodeUrl)
        .persist()
        .get(DEPLOYMENT_INFO_PATH)
        .query({ "id.owner": address, "id.dseq": dseq })
        .reply(404, { code: 5, message: "codespace deployment code 4: Deployment not found", details: [] });
    }

    async function queueCreate(retryOverrides: EnqueueOptions = {}, beforeWorkersStart: (dseq: string) => Promise<void> = async () => undefined) {
      const { accepted } = await runAsCaller(() => writer.acceptCreate({ userId: user.id, sdl: SDL, projectId }));
      const activity = await activityRepository.create(creatingActivityOf(accepted));
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
      wallet,
      broadcast,
      queueCreate,
      answerDeploymentAtRecordedVersion,
      answerDeploymentAbsent,
      createInBackground: async () => await runAsCaller(() => writer.createInBackground({ userId: user.id, sdl: SDL, projectId })),
      findActivities: async () => await activityRepository.find({ userId: user.id }),
      findActivity: async (id: string) => await activityRepository.findById(id),
      findCompensation: async (dseq: string) => {
        const [compensation] = await findJobRows(DeleteUnbackedDeploymentSetting[JOB_NAME], {
          singletonKey: `deleteUnbackedDeploymentSetting.${user.id}.${dseq}`
        });
        return compensation;
      },
      waitForJobIn: async (accepted: { walletId: number; dseq: string }, state: "failed" | "retry") =>
        await vi.waitFor(
          async () => {
            const [row] = await findJobRows(CreateDeployment[JOB_NAME], { singletonKey: createDeploymentKeyFor(accepted) });
            expect(row?.state).toBe(state);
          },
          { timeout: 15_000, interval: 100 }
        )
    };
  }

  async function seedPersonalCaller() {
    const { user, wallet, address } = await seedUserWithWallet();

    return { user, wallet, address, projectId: undefined, runAsCaller: <T>(cb: () => Promise<T>) => runAsUser(user, cb) };
  }

  async function seedTeamMember() {
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const { organization } = await seedOrganizationWithOwner();
    const project = await seedProject({ organizationId: organization.id });
    const member = await seedUser();
    const membership = await seedOrganizationMember({ organizationId: organization.id, userId: member.id, role: "member" });
    const grant = await seedProjectMember({ organizationId: organization.id, projectId: project.id, userId: member.id, role: "member" });
    const wallet = await seedOrganizationWallet({ organizationId: organization.id, activatedAt: new Date() });
    vi.spyOn(container.resolve(DenomExchangeService), "getExchangeRateToUSD").mockResolvedValue({
      price: 2,
      volume: 0,
      marketCap: 0,
      marketCapRank: 0,
      priceChange24h: 0,
      priceChangePercentage24: 0
    });

    const revocations: Record<Revocation, () => Promise<unknown>> = {
      membership: () => db.delete(resolveTable("OrganizationMembers")).where(eq(resolveTable("OrganizationMembers").id, membership.id)),
      projectGrant: () => db.delete(resolveTable("ProjectMembers")).where(eq(resolveTable("ProjectMembers").id, grant.id)),
      role: () =>
        db
          .update(resolveTable("OrganizationMembers"))
          .set({ role: "viewer" })
          .where(eq(resolveTable("OrganizationMembers").id, membership.id)),
      team: () =>
        db
          .update(resolveTable("Organizations"))
          .set({ deletedAt: new Date() })
          .where(eq(resolveTable("Organizations").id, organization.id))
    };
    revokeAccess = async revocation => await revocations[revocation]();

    return {
      user: member,
      wallet,
      address: wallet.address,
      projectId: project.id,
      runAsCaller: <T>(cb: () => Promise<T>) => runAsMemberOf(member, organization.id, cb)
    };
  }

  async function runAsMemberOf<T>(user: UserOutput, organizationId: string, cb: () => Promise<T>): Promise<T> {
    const executionContextService = container.resolve(ExecutionContextService);
    const context = await container.resolve(OrganizationContextResolver).resolveBoundTo(user, organizationId);

    return await executionContextService.runWithContext(async () => {
      executionContextService.set("CURRENT_USER", user);
      executionContextService.set("ORGANIZATION_CONTEXT", context);
      executionContextService.set("ABILITY", container.resolve(AbilityService).getAbilityFor("REGULAR_USER", user));

      return await cb();
    });
  }
});
