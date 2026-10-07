import "@src/app/providers/jobs.provider";

import { DeploymentHttpService } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import { addMinutes } from "date-fns";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ActivityStatus } from "@src/activity/model-schemas";
import { ActivityRepository } from "@src/activity/repositories/activity/activity.repository";
import { JOB_NAME } from "@src/core";
import { CloseDeploymentHandler } from "@src/deployment/services/close-deployment/close-deployment.handler";
import { CloseDeployment, closeDeploymentKeyFor } from "@src/deployment/services/close-deployment/close-deployment.job";
import { ReconcileDeploymentCloseHandler } from "./reconcile-deployment-close.handler";
import { ReconcileDeploymentClose, reconcileDeploymentCloseKeyFor, reconcileDeploymentCloseOptionsFor } from "./reconcile-deployment-close.job";

import { seedUserWithWallet } from "@test/seeders/db/user-with-wallet.seeder";
import { createDeploymentInfoSeed } from "@test/seeders/deployment-info.seeder";
import { expectJobCompleted, findJobRows, useJobWorkers } from "@test/services/job-queue-harness";

const jobWorkers = useJobWorkers(() => [container.resolve(ReconcileDeploymentCloseHandler), container.resolve(CloseDeploymentHandler)]);

describe(ReconcileDeploymentCloseHandler.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("records a close whose job is gone as succeeded when the deployment is closed, run the way a worker runs it", async () => {
    const { reconcile, findActivity, activityId } = await setup({ deploymentState: "closed" });

    await reconcile({ closeJobId: faker.string.uuid() });

    await expectJobCompleted(ReconcileDeploymentClose[JOB_NAME], { data: { activityId } });
    expect(await findActivity()).toMatchObject({ status: "succeeded", meta: { dseq: expect.any(String) } });
  });

  it("records a close whose job is gone as failed when the deployment is still open", async () => {
    const { reconcile, findActivity, activityId } = await setup({ deploymentState: "active" });

    await reconcile({ closeJobId: faker.string.uuid() });

    await expectJobCompleted(ReconcileDeploymentClose[JOB_NAME], { data: { activityId } });
    expect(await findActivity()).toMatchObject({
      status: "failed",
      meta: { error: { code: "close_incomplete", message: "The deployment is still open. Try closing it again." } }
    });
  });

  it("leaves the activity pending and checks again later while the close job is still queued", async () => {
    const { reconcile, queueCloseJob, findActivity, activityId, readDeployment } = await setup({ deploymentState: "active" });
    const closeJobId = await queueCloseJob();

    await reconcile({ closeJobId });

    await expectJobCompleted(ReconcileDeploymentClose[JOB_NAME], { data: { activityId }, state: "completed" });
    const [nextCheck] = await findJobRows(ReconcileDeploymentClose[JOB_NAME], { data: { activityId }, state: "created" });
    expect(new Date(nextCheck.start_after).getTime()).toBeGreaterThan(addMinutes(new Date(), 4).getTime());
    expect(nextCheck.data).toMatchObject({ activityId, closeJobId });
    expect(readDeployment).not.toHaveBeenCalled();
    expect(await findActivity()).toMatchObject({ status: "pending" });
  });

  it("keeps one waiting check per activity when a second one is queued for it", async () => {
    const { queueCheck, activityId } = await setup({ deploymentState: "active" });

    await queueCheck();
    await queueCheck();

    expect(await findJobRows(ReconcileDeploymentClose[JOB_NAME], { data: { activityId } })).toHaveLength(1);
  });

  it("leaves an activity its close already settled as it is", async () => {
    const { reconcile, findActivity, activityId, readDeployment } = await setup({ deploymentState: "active", status: "succeeded" });

    await reconcile({ closeJobId: faker.string.uuid() });

    await expectJobCompleted(ReconcileDeploymentClose[JOB_NAME], { data: { activityId } });
    expect(readDeployment).not.toHaveBeenCalled();
    expect(await findActivity()).toMatchObject({ status: "succeeded" });
  });

  async function setup(input: { deploymentState: string; status?: ActivityStatus }) {
    const { enqueue, startWorkers } = await jobWorkers();
    const activityRepository = container.resolve(ActivityRepository);
    const { wallet } = await seedUserWithWallet();
    const owner = wallet.address as string;
    const dseq = faker.string.numeric({ length: 8, allowLeadingZeros: false });
    const activity = await activityRepository.create({ userId: wallet.userId, type: "deployment_close", status: input.status ?? "pending", meta: { dseq } });
    const readDeployment = vi
      .spyOn(container.resolve(DeploymentHttpService), "findByOwnerAndDseq")
      .mockResolvedValue(createDeploymentInfoSeed({ owner, dseq, state: input.deploymentState }));

    return {
      activityId: activity.id,
      readDeployment,
      queueCloseJob: async () =>
        (await enqueue(new CloseDeployment({ userId: wallet.userId, dseq, activityId: activity.id }), {
          singletonKey: closeDeploymentKeyFor({ userId: wallet.userId, dseq }),
          startAfter: addMinutes(new Date(), 60).toISOString()
        })) as string,
      queueCheck: async () =>
        await enqueue(
          new ReconcileDeploymentClose({ userId: wallet.userId, owner, dseq, activityId: activity.id, closeJobId: faker.string.uuid() }),
          reconcileDeploymentCloseOptionsFor(activity.id, new Date())
        ),
      reconcile: async ({ closeJobId }: { closeJobId: string }) => {
        await enqueue(new ReconcileDeploymentClose({ userId: wallet.userId, owner, dseq, activityId: activity.id, closeJobId }), {
          singletonKey: reconcileDeploymentCloseKeyFor(activity.id)
        });
        await startWorkers();
      },
      findActivity: async () => await activityRepository.findById(activity.id)
    };
  }
});
