import "@src/app/providers/jobs.provider";

import { faker } from "@faker-js/faker";
import createError from "http-errors";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ActivityRepository } from "@src/activity/repositories/activity/activity.repository";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { type EnqueueOptions, type Job, JOB_NAME, type JobHandler } from "@src/core";
import type { DeploymentResponse } from "@src/deployment/http-schemas/deployment.schema";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { DeploymentReaderService } from "@src/deployment/services/deployment-reader/deployment-reader.service";
import { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import { SdlService } from "@src/deployment/services/sdl/sdl.service";
import { SdlSecretsService } from "@src/deployment/services/sdl-secrets/sdl-secrets.service";
import { ProviderService } from "@src/provider/services/provider/provider.service";
import { ApplyDeploymentUpdateHandler } from "./apply-deployment-update.handler";
import { APPLY_DEPLOYMENT_UPDATE_RETRY_OPTIONS, ApplyDeploymentUpdate, applyDeploymentUpdateKeyFor } from "./apply-deployment-update.job";

import { registerFakeSdlSecretsKms, warmSealingKeyAsBootWould } from "@test/mocks/sdl-secrets-kms.mock";
import { createDseq } from "@test/seeders/db/deployment-setting.seeder";
import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { expectJobCompleted, findJobRows, runAsUser, useJobWorkers } from "@test/services/job-queue-harness";

registerFakeSdlSecretsKms();

const SAVED_SDL = `version: "2.0"
services:
  web:
    image: nginx
    env:
      - API_TOKEN=ac-secret://API_TOKEN
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
          units: 0.1
        memory:
          size: 128Mi
        storage:
          - size: 128Mi
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

const LEASE_PROVIDER = "akash1provider";

/** Two workers per queue, as every production instance runs, so one deployment's applies would overlap unless the queue keeps them apart. */
const PRODUCTION_WORKERS_PER_QUEUE = 2;

const jobWorkers = useJobWorkers(() => [runningAsProductionDoes(container.resolve(ApplyDeploymentUpdateHandler))]);

function runningAsProductionDoes<T extends Job>(handler: JobHandler<T>): JobHandler<T> {
  return {
    accepts: handler.accepts,
    policy: handler.policy,
    concurrency: PRODUCTION_WORKERS_PER_QUEUE,
    requiresPermission: payload => handler.requiresPermission(payload),
    handle: (payload, job) => handler.handle(payload, job)
  };
}

describe(ApplyDeploymentUpdateHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("applies the saved version on chain and pushes its manifest, then records the update as succeeded, run the way a worker runs it", async () => {
    const { user, saved, secretValue, applyInBackground, broadcast, pushManifest, findActivity } = await setup();

    await applyInBackground(saved);

    await expectJobCompleted(ApplyDeploymentUpdate[JOB_NAME], { data: { activityId: saved.activityId } });
    const [[signingWallet, [update]]] = broadcast.mock.calls;
    expect(signingWallet).toMatchObject({ userId: user.id });
    expect(Buffer.from(update.value.hash).toString("base64")).toBe(saved.manifestVersion);
    expect(pushManifest).toHaveBeenCalledWith(
      expect.objectContaining({ provider: LEASE_PROVIDER, manifest: expect.stringContaining(`API_TOKEN=${secretValue}`) })
    );
    expect(await findActivity(saved.activityId)).toMatchObject({
      status: "succeeded",
      meta: { dseq: saved.dseq, manifestVersion: saved.manifestVersion }
    });
  });

  it("applies nothing for a version a newer save replaced, and records it as succeeded", async () => {
    const { saved, openActivity, applyInBackground, broadcast, pushManifest, findActivity } = await setup();
    const replaced = { ...saved, manifestVersion: Buffer.from("a replaced version").toString("base64"), activityId: await openActivity() };

    await applyInBackground(replaced);

    await expectJobCompleted(ApplyDeploymentUpdate[JOB_NAME], { data: { activityId: replaced.activityId } });
    expect(broadcast).not.toHaveBeenCalled();
    expect(pushManifest).not.toHaveBeenCalled();
    expect(await findActivity(replaced.activityId)).toMatchObject({ status: "succeeded" });
  });

  it("records the update as failed with its reason once the last attempt fails", async () => {
    const { saved, applyInBackground, pushManifest, findActivity, waitForJobIn } = await setup();
    pushManifest.mockRejectedValue(createError(404, `Provider ${LEASE_PROVIDER} not found`));

    await applyInBackground(saved, { retryLimit: 0 });

    await waitForJobIn(saved.activityId, "failed");
    expect(await findActivity(saved.activityId)).toMatchObject({
      status: "failed",
      meta: { error: { code: "update_failed", message: `Provider ${LEASE_PROVIDER} not found` } }
    });
  });

  it("keeps the activity pending while the update still has retries to come", async () => {
    const { saved, applyInBackground, pushManifest, findActivity, waitForJobIn } = await setup();
    pushManifest.mockRejectedValue(new Error("provider unreachable"));

    await applyInBackground(saved, { retryLimit: 3, retryDelay: 3600 });

    await waitForJobIn(saved.activityId, "retry");
    expect(await findActivity(saved.activityId)).toMatchObject({ status: "pending" });
  });

  it("applies the updates of one deployment one at a time, while another deployment's update runs beside them", async () => {
    const { user, openActivity, enqueueApply, startWorkers } = await setup();
    const [dseq, otherDseq] = [createDseq(), createDseq()];
    const older = { userId: user.id, dseq, manifestVersion: "b2xkZXI=", activityId: await openActivity(dseq) };
    const newer = { userId: user.id, dseq, manifestVersion: "bmV3ZXI=", activityId: await openActivity(dseq) };
    const other = { userId: user.id, dseq: otherDseq, manifestVersion: "b3RoZXI=", activityId: await openActivity(otherDseq) };
    const applies = holdTheApplyOf(older.manifestVersion);

    await enqueueApply(older);
    await enqueueApply(other);
    await enqueueApply(newer);
    await startWorkers();
    await applies.heldApplyStarted;
    await expectJobCompleted(ApplyDeploymentUpdate[JOB_NAME], { data: { activityId: other.activityId } });
    const [newerWhileOlderRuns] = await findJobRows(ApplyDeploymentUpdate[JOB_NAME], { data: { activityId: newer.activityId } });
    applies.release();
    await expectJobCompleted(ApplyDeploymentUpdate[JOB_NAME], { data: { activityId: newer.activityId } });

    expect(newerWhileOlderRuns.state).toBe("created");
    expect(applies.log.filter(entry => entry.endsWith(dseq))).toEqual([
      `start b2xkZXI= ${dseq}`,
      `end b2xkZXI= ${dseq}`,
      `start bmV3ZXI= ${dseq}`,
      `end bmV3ZXI= ${dseq}`
    ]);
  });

  function holdTheApplyOf(heldVersion: string) {
    const log: string[] = [];
    let started!: () => void;
    let release!: () => void;
    const heldApplyStarted = new Promise<void>(resolve => (started = resolve));
    const held = new Promise<void>(resolve => (release = resolve));

    vi.spyOn(container.resolve(DeploymentWriterService), "applySavedPatch").mockImplementation(async ({ dseq, manifestVersion }) => {
      log.push(`start ${manifestVersion} ${dseq}`);
      if (manifestVersion === heldVersion) {
        started();
        await held;
      }
      log.push(`end ${manifestVersion} ${dseq}`);
    });

    return { log, heldApplyStarted, release };
  }

  async function setup() {
    const { enqueue, startWorkers } = await jobWorkers();
    await warmSealingKeyAsBootWould();
    const activityRepository = container.resolve(ActivityRepository);

    const { user, address } = await seedUserWithWallet();
    const dseq = createDseq();
    const secretValue = faker.string.alphanumeric(24);
    const secrets = { API_TOKEN: secretValue };
    const sealedSecrets = await runAsUser(user, () => container.resolve(SdlSecretsService).sealForStorage({ userId: user.id, dseq, secrets }));
    const manifestVersion = await savedVersionOf(SAVED_SDL, secrets);
    await container.resolve(DeploymentSettingRepository).upsertDefinition({ userId: user.id, dseq, sdl: SAVED_SDL, manifestVersion, sealedSecrets });

    vi.spyOn(container.resolve(DeploymentReaderService), "findByWalletAndDseqWithoutProviderStatus").mockResolvedValue(
      chainHoldingAnOlderVersion(address, dseq)
    );
    const broadcast = vi
      .spyOn(container.resolve(ManagedSignerService), "executeDecodedTxByUserWallet")
      .mockResolvedValue({ code: 0, hash: "tx-hash", transactionHash: "tx-hash", rawLog: "" });
    const pushManifest = vi.spyOn(container.resolve(ProviderService), "sendManifest").mockResolvedValue(true);
    vi.spyOn(container.resolve(ProviderService), "toProviderAuth").mockResolvedValue({ type: "jwt", token: "provider-token" });

    async function openActivity(activityDseq = dseq) {
      const activity = await activityRepository.create({ userId: user.id, type: "deployment_update", status: "pending", meta: { dseq: activityDseq } });

      return activity.id;
    }

    async function enqueueApply(update: ApplyDeploymentUpdate["data"], retryOverrides: EnqueueOptions = {}) {
      await enqueue(new ApplyDeploymentUpdate(update), {
        singletonKey: applyDeploymentUpdateKeyFor(update),
        ...APPLY_DEPLOYMENT_UPDATE_RETRY_OPTIONS,
        ...retryOverrides
      });
    }

    return {
      user,
      saved: { userId: user.id, dseq, manifestVersion, activityId: await openActivity() },
      secretValue,
      broadcast,
      pushManifest,
      openActivity,
      enqueueApply,
      startWorkers,
      applyInBackground: async (update: ApplyDeploymentUpdate["data"], retryOverrides: EnqueueOptions = {}) => {
        await enqueueApply(update, retryOverrides);
        await startWorkers();
      },
      findActivity: async (id: string) => await activityRepository.findById(id),
      waitForJobIn: async (activityId: string, state: "failed" | "retry") =>
        await vi.waitFor(
          async () => {
            const [row] = await findJobRows(ApplyDeploymentUpdate[JOB_NAME], { data: { activityId } });
            expect(row?.state).toBe(state);
          },
          { timeout: 15_000, interval: 100 }
        )
    };
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
