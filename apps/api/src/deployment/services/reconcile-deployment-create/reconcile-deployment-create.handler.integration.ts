import "@src/app/providers/jobs.provider";

import { DeploymentHttpService } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import { addMinutes } from "date-fns";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ActivityStatus } from "@src/activity/model-schemas";
import { ActivityRepository } from "@src/activity/repositories/activity/activity.repository";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { JOB_NAME } from "@src/core";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { CreateDeploymentHandler } from "@src/deployment/services/create-deployment/create-deployment.handler";
import { CreateDeployment, createDeploymentKeyFor } from "@src/deployment/services/create-deployment/create-deployment.job";
import {
  DeleteUnbackedDeploymentSetting,
  DeleteUnbackedDeploymentSettingHandler
} from "@src/deployment/services/delete-unbacked-deployment-setting/delete-unbacked-deployment-setting.handler";
import { DeploymentPresenceService } from "@src/deployment/services/deployment-presence/deployment-presence.service";
import { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import { RecordDeploymentSettingHandler } from "@src/deployment/services/record-deployment-setting/record-deployment-setting.handler";
import { ReconcileDeploymentCreateHandler } from "./reconcile-deployment-create.handler";
import { ReconcileDeploymentCreate, reconcileDeploymentCreateKeyFor } from "./reconcile-deployment-create.job";

import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { createDeploymentInfoErrorSeed, createDeploymentInfoSeed } from "@test/seeders/deployment-info.seeder";
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

const jobWorkers = useJobWorkers(() => [
  container.resolve(ReconcileDeploymentCreateHandler),
  container.resolve(CreateDeploymentHandler),
  container.resolve(DeleteUnbackedDeploymentSettingHandler),
  container.resolve(RecordDeploymentSettingHandler)
]);

describe(ReconcileDeploymentCreateHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("records a create whose job is gone as succeeded, adopting the deployment the chain holds at the recorded version, run the way a worker runs it", async () => {
    const { reconcile, findActivity, findCompensation, activityId } = await setup({ onChain: "at the recorded version" });

    await reconcile({ createJobId: faker.string.uuid() });

    await expectJobCompleted(ReconcileDeploymentCreate[JOB_NAME], { data: { activityId } });
    expect(await findActivity()).toMatchObject({ status: "succeeded", meta: { dseq: expect.any(String) } });
    expect((await findCompensation()).state).toBe("cancelled");
  });

  it("records a create whose job is gone as failed once the chain proves the deployment absent past its last send", async () => {
    const { reconcile, findActivity, findSetting, isOnChain, activityId, owner } = await setup({ onChain: "absent" });

    await reconcile({ createJobId: faker.string.uuid() });

    await expectJobCompleted(ReconcileDeploymentCreate[JOB_NAME], { data: { activityId } });
    expect(await findActivity()).toMatchObject({
      status: "failed",
      meta: { error: { code: "create_incomplete", message: "The deployment was not created. Try creating it again." } }
    });
    const setting = await findSetting();
    expect(isOnChain).toHaveBeenCalledWith({ owner, dseq: setting!.dseq, recordedAt: new Date(setting!.updatedAt) });
  });

  it("leaves the activity pending and checks again later while the create job is still queued", async () => {
    const { reconcile, queueCreateJob, findActivity, activityId, readDeployment } = await setup({ onChain: "absent" });
    const createJobId = await queueCreateJob();

    await reconcile({ createJobId });

    await expectJobCompleted(ReconcileDeploymentCreate[JOB_NAME], { data: { activityId }, state: "completed" });
    const [nextCheck] = await findJobRows(ReconcileDeploymentCreate[JOB_NAME], { data: { activityId }, state: "created" });
    expect(new Date(nextCheck.start_after).getTime()).toBeGreaterThan(addMinutes(new Date(), 9).getTime());
    expect(nextCheck.data).toMatchObject({ activityId, createJobId });
    expect(readDeployment).not.toHaveBeenCalled();
    expect(await findActivity()).toMatchObject({ status: "pending" });
  });

  it("leaves an activity its create already settled as it is", async () => {
    const { reconcile, findActivity, activityId, readDeployment } = await setup({ onChain: "absent", status: "succeeded" });

    await reconcile({ createJobId: faker.string.uuid() });

    await expectJobCompleted(ReconcileDeploymentCreate[JOB_NAME], { data: { activityId } });
    expect(readDeployment).not.toHaveBeenCalled();
    expect(await findActivity()).toMatchObject({ status: "succeeded" });
  });

  async function setup(input: { onChain: "at the recorded version" | "absent"; status?: ActivityStatus }) {
    const { enqueue, startWorkers } = await jobWorkers();
    const activityRepository = container.resolve(ActivityRepository);
    const deploymentSettingRepository = container.resolve(DeploymentSettingRepository);
    const { user, address: owner } = await seedUserWithWallet();
    vi.spyOn(container.resolve(ManagedSignerService), "assertCanBroadcast").mockResolvedValue(undefined);
    const { accepted } = await runAsUser(user, () => container.resolve(DeploymentWriterService).acceptCreate({ userId: user.id, sdl: SDL }));
    const { dseq } = accepted;
    const setting = await deploymentSettingRepository.findOneBy({ userId: user.id, dseq });
    const activity = await activityRepository.create({ userId: user.id, type: "deployment_create", status: input.status ?? "pending", meta: { dseq } });
    const readDeployment = vi
      .spyOn(container.resolve(DeploymentHttpService), "findByOwnerAndDseq")
      .mockResolvedValue(
        input.onChain === "absent"
          ? createDeploymentInfoErrorSeed({ code: 5, message: "deployment not found" })
          : createDeploymentInfoSeed({ owner, dseq, version: setting!.manifestVersion! })
      );
    const isOnChain = vi.spyOn(container.resolve(DeploymentPresenceService), "isOnChain").mockResolvedValue(input.onChain !== "absent");

    return {
      activityId: activity.id,
      owner,
      readDeployment,
      isOnChain,
      queueCreateJob: async () =>
        (await enqueue(new CreateDeployment({ ...accepted, activityId: activity.id }), {
          singletonKey: createDeploymentKeyFor(accepted),
          startAfter: addMinutes(new Date(), 60).toISOString()
        })) as string,
      reconcile: async ({ createJobId }: { createJobId: string }) => {
        await enqueue(new ReconcileDeploymentCreate({ ...accepted, activityId: activity.id, createJobId }), {
          singletonKey: reconcileDeploymentCreateKeyFor(activity.id)
        });
        await startWorkers();
      },
      findActivity: async () => await activityRepository.findById(activity.id),
      findSetting: async () => await deploymentSettingRepository.findOneBy({ userId: user.id, dseq }),
      findCompensation: async () => {
        const [compensation] = await findJobRows(DeleteUnbackedDeploymentSetting[JOB_NAME], { singletonKey: `deleteUnbackedDeploymentSetting.${user.id}.${dseq}` });
        return compensation;
      }
    };
  }
});
