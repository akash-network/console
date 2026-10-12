import "@src/app/providers/jobs.provider";

import { DeploymentHttpService } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import { addMinutes } from "date-fns";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ActivityStatus } from "@src/activity/model-schemas";
import { ActivityRepository } from "@src/activity/repositories/activity/activity.repository";
import { JOB_NAME } from "@src/core";
import { ApplyDeploymentUpdateHandler } from "@src/deployment/services/apply-deployment-update/apply-deployment-update.handler";
import { ApplyDeploymentUpdate, applyDeploymentUpdateKeyFor } from "@src/deployment/services/apply-deployment-update/apply-deployment-update.job";
import { ReconcileDeploymentUpdateHandler } from "./reconcile-deployment-update.handler";
import { ReconcileDeploymentUpdate, reconcileDeploymentUpdateKeyFor, reconcileDeploymentUpdateOptionsFor } from "./reconcile-deployment-update.job";

import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { createDeploymentInfoSeed } from "@test/seeders/deployment-info.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const SAVED_VERSION = "U0FWRUQ=";

const jobWorkers = useJobWorkers(() => [container.resolve(ReconcileDeploymentUpdateHandler), container.resolve(ApplyDeploymentUpdateHandler)]);

describe(ReconcileDeploymentUpdateHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("records an update whose job is gone as not delivered when the deployment runs its version, run the way a worker runs it", async () => {
    const { reconcile, findActivity, activityId } = await setup({ chainVersion: SAVED_VERSION });

    await reconcile({ updateJobId: faker.string.uuid() });

    await expectJobCompleted(ReconcileDeploymentUpdate[JOB_NAME], { data: { activityId } });
    expect(await findActivity()).toMatchObject({
      status: "failed",
      meta: { manifestVersion: SAVED_VERSION, error: { code: "update_not_delivered" } }
    });
  });

  it("records an update whose job is gone as not applied when the deployment runs another version", async () => {
    const { reconcile, findActivity, activityId } = await setup({ chainVersion: "T0xERVI=" });

    await reconcile({ updateJobId: faker.string.uuid() });

    await expectJobCompleted(ReconcileDeploymentUpdate[JOB_NAME], { data: { activityId } });
    expect(await findActivity()).toMatchObject({
      status: "failed",
      meta: { error: { code: "update_incomplete", message: "The update did not go through. Try updating it again." } }
    });
  });

  it("leaves the activity pending and checks again later while the update job is still queued", async () => {
    const { reconcile, queueUpdateJob, findActivity, activityId, readDeployment } = await setup({ chainVersion: SAVED_VERSION });
    const updateJobId = await queueUpdateJob();

    await reconcile({ updateJobId });

    await expectJobCompleted(ReconcileDeploymentUpdate[JOB_NAME], { data: { activityId }, state: "completed" });
    const [nextCheck] = await findJobRows(ReconcileDeploymentUpdate[JOB_NAME], { data: { activityId }, state: "created" });
    expect(new Date(nextCheck.start_after).getTime()).toBeGreaterThan(addMinutes(new Date(), 4).getTime());
    expect(nextCheck.data).toMatchObject({ activityId, updateJobId });
    expect(readDeployment).not.toHaveBeenCalled();
    expect(await findActivity()).toMatchObject({ status: "pending" });
  });

  it("keeps one waiting check per activity when a second one is queued for it", async () => {
    const { queueCheck, activityId } = await setup({ chainVersion: SAVED_VERSION });

    await queueCheck();
    await queueCheck();

    expect(await findJobRows(ReconcileDeploymentUpdate[JOB_NAME], { data: { activityId } })).toHaveLength(1);
  });

  it("leaves an activity its update already settled as it is", async () => {
    const { reconcile, findActivity, activityId, readDeployment } = await setup({ chainVersion: SAVED_VERSION, status: "succeeded" });

    await reconcile({ updateJobId: faker.string.uuid() });

    await expectJobCompleted(ReconcileDeploymentUpdate[JOB_NAME], { data: { activityId } });
    expect(readDeployment).not.toHaveBeenCalled();
    expect(await findActivity()).toMatchObject({ status: "succeeded" });
  });

  async function setup(input: { chainVersion: string; status?: ActivityStatus }) {
    const { enqueue, startWorkers } = await jobWorkers();
    const activityRepository = container.resolve(ActivityRepository);
    const { wallet } = await seedUserWithWallet();
    const owner = wallet.address as string;
    const dseq = faker.string.numeric({ length: 8, allowLeadingZeros: false });
    const activity = await activityRepository.create({
      userId: wallet.userId,
      type: "deployment_update",
      status: input.status ?? "pending",
      meta: { dseq, manifestVersion: SAVED_VERSION }
    });
    const update = { userId: wallet.userId, owner, dseq, manifestVersion: SAVED_VERSION, activityId: activity.id };
    const readDeployment = vi
      .spyOn(container.resolve(DeploymentHttpService), "findByOwnerAndDseq")
      .mockResolvedValue(createDeploymentInfoSeed({ owner, dseq, version: input.chainVersion }));

    return {
      activityId: activity.id,
      readDeployment,
      queueUpdateJob: async () =>
        (await enqueue(new ApplyDeploymentUpdate({ userId: wallet.userId, dseq, manifestVersion: SAVED_VERSION, activityId: activity.id }), {
          singletonKey: applyDeploymentUpdateKeyFor({ userId: wallet.userId, dseq }),
          startAfter: addMinutes(new Date(), 60).toISOString()
        })) as string,
      queueCheck: async () =>
        await enqueue(
          new ReconcileDeploymentUpdate({ ...update, updateJobId: faker.string.uuid() }),
          reconcileDeploymentUpdateOptionsFor(activity.id, new Date())
        ),
      reconcile: async ({ updateJobId }: { updateJobId: string }) => {
        await enqueue(new ReconcileDeploymentUpdate({ ...update, updateJobId }), { singletonKey: reconcileDeploymentUpdateKeyFor(activity.id) });
        await startWorkers();
      },
      findActivity: async () => await activityRepository.findById(activity.id)
    };
  }
});
