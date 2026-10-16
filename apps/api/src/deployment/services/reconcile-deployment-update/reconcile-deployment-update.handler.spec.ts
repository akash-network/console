import type { DeploymentHttpService } from "@akashnetwork/http-sdk";
import { addMinutes, addSeconds, subMinutes } from "date-fns";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ActivityService } from "@src/activity/services/activity/activity.service";
import type { JobQueueService } from "@src/core";
import { ApplyDeploymentUpdate } from "@src/deployment/services/apply-deployment-update/apply-deployment-update.job";
import { notAppliedUpdateActivityOf, undeliveredUpdateActivityOf } from "@src/deployment/utils/update-activity/update-activity";
import { ReconcileDeploymentUpdateHandler } from "./reconcile-deployment-update.handler";
import { ReconcileDeploymentUpdate } from "./reconcile-deployment-update.job";

import { createDeploymentInfoErrorSeed, createDeploymentInfoSeed } from "@test/seeders/deployment-info.seeder";

describe(ReconcileDeploymentUpdateHandler.name, () => {
  const NOW = new Date("2026-10-07T12:00:00.000Z");
  const SAVED_VERSION = "U0FWRUQ=";
  const DATA = { userId: "user-1", owner: "akash1owner", dseq: "100", manifestVersion: SAVED_VERSION, activityId: "activity-1", updateJobId: "job-1" };
  const PAYLOAD = { ...DATA, version: 1 as const };

  it("asks for no user's permission, since it only reads the activity and the deployment", () => {
    const { handler } = setup();

    expect(handler.requiresPermission()).toEqual([]);
  });

  it("keeps one waiting check per activity, so a run retried after queueing the next check queues no second one", () => {
    const { handler } = setup();

    expect(handler.policy).toBe("short");
  });

  it("leaves alone an activity its update already settled", async () => {
    const { handler, activityService, jobQueueService, deploymentHttpService } = setup({ pending: false });

    await handler.handle(PAYLOAD);

    expect(activityService.isPending).toHaveBeenCalledWith("activity-1");
    expect(jobQueueService.findJob).not.toHaveBeenCalled();
    expect(deploymentHttpService.findByOwnerAndDseq).not.toHaveBeenCalled();
    expect(activityService.settle).not.toHaveBeenCalled();
  });

  it("checks again later, with the same retries, while the update job has not finished", async () => {
    const { handler, activityService, jobQueueService, deploymentHttpService } = setup({ updateJob: { completedOn: null } });

    await handler.handle(PAYLOAD);

    expect(jobQueueService.findJob).toHaveBeenCalledWith(ApplyDeploymentUpdate, "job-1");
    expect(jobQueueService.enqueue).toHaveBeenCalledWith(new ReconcileDeploymentUpdate(DATA), {
      singletonKey: "reconcileDeploymentUpdate.activity-1",
      startAfter: addMinutes(NOW, 5).toISOString(),
      retryLimit: 12,
      retryBackoff: true,
      retryDelay: 30,
      retryDelayMax: 300
    });
    expect(deploymentHttpService.findByOwnerAndDseq).not.toHaveBeenCalled();
    expect(activityService.settle).not.toHaveBeenCalled();
  });

  it("checks again later when the update job finished too recently for what it sent to have landed or expired", async () => {
    const { handler, activityService, jobQueueService, deploymentHttpService } = setup({ updateJob: { completedOn: addSeconds(subMinutes(NOW, 5), 1) } });

    await handler.handle(PAYLOAD);

    expect(jobQueueService.enqueue).toHaveBeenCalledWith(
      new ReconcileDeploymentUpdate(DATA),
      expect.objectContaining({ startAfter: addMinutes(NOW, 5).toISOString() })
    );
    expect(deploymentHttpService.findByOwnerAndDseq).not.toHaveBeenCalled();
    expect(activityService.settle).not.toHaveBeenCalled();
  });

  it("reads the deployment of the owner the update was for once its job has been over long enough", async () => {
    const { handler, jobQueueService, deploymentHttpService } = setup({ updateJob: { completedOn: subMinutes(NOW, 5) } });

    await handler.handle(PAYLOAD);

    expect(deploymentHttpService.findByOwnerAndDseq).toHaveBeenCalledWith("akash1owner", "100");
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
  });

  it("records the update as failed for want of the manifest when the deployment runs the version it saved", async () => {
    const { handler, activityService } = setup({ chainVersion: SAVED_VERSION });

    await handler.handle(PAYLOAD);

    expect(activityService.settle).toHaveBeenCalledWith("activity-1", undeliveredUpdateActivityOf(DATA));
  });

  it("records the update as not applied when the deployment runs another version", async () => {
    const { handler, activityService } = setup({ chainVersion: "T0xERVI=" });

    await handler.handle(PAYLOAD);

    expect(activityService.settle).toHaveBeenCalledWith("activity-1", notAppliedUpdateActivityOf(DATA));
  });

  it("reads the deployment once pg-boss no longer keeps the update job", async () => {
    const { handler, activityService } = setup({ isUpdateJobGone: true, chainVersion: SAVED_VERSION });

    await handler.handle(PAYLOAD);

    expect(activityService.settle).toHaveBeenCalledWith("activity-1", undeliveredUpdateActivityOf(DATA));
  });

  it("reads the deployment straight away for an update the request applied itself, which no job waits on", async () => {
    const { handler, activityService, jobQueueService } = setup({ chainVersion: SAVED_VERSION });
    const { updateJobId: _updateJobId, ...requestUpdate } = DATA;

    await handler.handle({ ...requestUpdate, version: 1 });

    expect(jobQueueService.findJob).not.toHaveBeenCalled();
    expect(activityService.settle).toHaveBeenCalledWith("activity-1", undeliveredUpdateActivityOf(requestUpdate));
  });

  it("fails without settling when the deployment cannot be read, so the read is retried", async () => {
    const { handler, activityService, deploymentHttpService } = setup();
    deploymentHttpService.findByOwnerAndDseq.mockResolvedValue(createDeploymentInfoErrorSeed({ code: 13, message: "node is catching up" }));

    await expect(handler.handle(PAYLOAD)).rejects.toThrow("Deployment 100 could not be read: node is catching up");

    expect(activityService.settle).not.toHaveBeenCalled();
  });

  function setup(input: { pending?: boolean; updateJob?: { completedOn: Date | null }; isUpdateJobGone?: boolean; chainVersion?: string } = {}) {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    onTestFinished(() => {
      vi.useRealTimers();
    });

    const activityService = mock<ActivityService>();
    activityService.isPending.mockResolvedValue(input.pending ?? true);
    const jobQueueService = mock<JobQueueService>();
    jobQueueService.findJob.mockResolvedValue(input.isUpdateJobGone ? undefined : input.updateJob ?? { completedOn: subMinutes(NOW, 10) });
    const deploymentHttpService = mock<DeploymentHttpService>();
    deploymentHttpService.findByOwnerAndDseq.mockResolvedValue(
      createDeploymentInfoSeed({ owner: DATA.owner, dseq: DATA.dseq, version: input.chainVersion ?? "T0xERVI=" })
    );

    const handler = new ReconcileDeploymentUpdateHandler(activityService, jobQueueService, deploymentHttpService);

    return { handler, activityService, jobQueueService, deploymentHttpService };
  }
});
