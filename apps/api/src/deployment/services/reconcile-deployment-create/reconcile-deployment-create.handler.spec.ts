import { addMinutes, addSeconds, subMinutes } from "date-fns";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ActivityService } from "@src/activity/services/activity/activity.service";
import type { JobQueueService } from "@src/core";
import { CreateDeployment } from "@src/deployment/services/create-deployment/create-deployment.job";
import type { DeploymentWriterService } from "@src/deployment/services/deployment-writer/deployment-writer.service";
import { createdActivityOf, notCreatedActivityOf } from "@src/deployment/utils/create-activity/create-activity";
import { ReconcileDeploymentCreateHandler } from "./reconcile-deployment-create.handler";
import { ReconcileDeploymentCreate } from "./reconcile-deployment-create.job";

describe(ReconcileDeploymentCreateHandler.name, () => {
  const NOW = new Date("2026-10-07T12:00:00.000Z");
  const ACCEPTED = { userId: "user-1", dseq: "1748400000000", message: "Cg1hY2NlcHRlZA==" };
  const DATA = { ...ACCEPTED, activityId: "activity-1", createJobId: "job-1" };
  const PAYLOAD = { ...DATA, version: 1 as const };

  it("asks only for the right to sign with the user's wallet, which adopting a created deployment reads", () => {
    const { handler } = setup();

    expect(handler.requiresPermission(PAYLOAD)).toEqual([{ action: "sign", subject: "UserWallet", conditions: { userId: "user-1" } }]);
  });

  it("keeps one waiting check per activity, so a run retried after queueing the next check queues no second one", () => {
    const { handler } = setup();

    expect(handler.policy).toBe("short");
  });

  it("leaves alone an activity its create already settled", async () => {
    const { handler, activityService, jobQueueService, deploymentWriterService } = setup({ pending: false });

    await handler.handle(PAYLOAD);

    expect(jobQueueService.findJob).not.toHaveBeenCalled();
    expect(deploymentWriterService.reconcileCreate).not.toHaveBeenCalled();
    expect(activityService.settle).not.toHaveBeenCalled();
  });

  it("checks again later, with the same retries, while the create job has not finished", async () => {
    const { handler, activityService, jobQueueService, deploymentWriterService } = setup({ createJob: { completedOn: null } });

    await handler.handle(PAYLOAD);

    expect(jobQueueService.findJob).toHaveBeenCalledWith(CreateDeployment, "job-1");
    expect(jobQueueService.enqueue).toHaveBeenCalledWith(new ReconcileDeploymentCreate(DATA), {
      singletonKey: "reconcileDeploymentCreate.activity-1",
      startAfter: addMinutes(NOW, 10).toISOString(),
      retryLimit: 12,
      retryBackoff: true,
      retryDelay: 30,
      retryDelayMax: 300
    });
    expect(deploymentWriterService.reconcileCreate).not.toHaveBeenCalled();
    expect(activityService.settle).not.toHaveBeenCalled();
  });

  it("checks again later when the create job finished too recently for the chain to prove what it sent absent", async () => {
    const { handler, activityService, jobQueueService, deploymentWriterService } = setup({ createJob: { completedOn: addSeconds(subMinutes(NOW, 10), 1) } });

    await handler.handle(PAYLOAD);

    expect(jobQueueService.enqueue).toHaveBeenCalledWith(
      new ReconcileDeploymentCreate(DATA),
      expect.objectContaining({ startAfter: addMinutes(NOW, 10).toISOString() })
    );
    expect(deploymentWriterService.reconcileCreate).not.toHaveBeenCalled();
    expect(activityService.settle).not.toHaveBeenCalled();
  });

  it("asks the chain about the accepted create once its job has been over long enough", async () => {
    const { handler, jobQueueService, deploymentWriterService } = setup({ createJob: { completedOn: subMinutes(NOW, 10) } });

    await handler.handle(PAYLOAD);

    expect(deploymentWriterService.reconcileCreate).toHaveBeenCalledWith(ACCEPTED);
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
  });

  it("records the create as succeeded when the deployment was created", async () => {
    const { handler, activityService } = setup({ isCreated: true });

    await handler.handle(PAYLOAD);

    expect(activityService.settle).toHaveBeenCalledWith("activity-1", createdActivityOf(ACCEPTED));
  });

  it("records the create as failed when the deployment was not created", async () => {
    const { handler, activityService } = setup({ isCreated: false });

    await handler.handle(PAYLOAD);

    expect(activityService.settle).toHaveBeenCalledWith("activity-1", notCreatedActivityOf(ACCEPTED));
  });

  it("asks the chain once pg-boss no longer keeps the create job", async () => {
    const { handler, activityService } = setup({ isCreateJobGone: true, isCreated: true });

    await handler.handle(PAYLOAD);

    expect(activityService.settle).toHaveBeenCalledWith("activity-1", createdActivityOf(ACCEPTED));
  });

  it("asks the chain straight away for a create the request performed itself, which no job waits on", async () => {
    const { handler, activityService, jobQueueService, deploymentWriterService } = setup({ isCreated: false });
    const { createJobId: _createJobId, ...requestCreate } = DATA;

    await handler.handle({ ...requestCreate, version: 1 });

    expect(jobQueueService.findJob).not.toHaveBeenCalled();
    expect(deploymentWriterService.reconcileCreate).toHaveBeenCalledWith(ACCEPTED);
    expect(activityService.settle).toHaveBeenCalledWith("activity-1", notCreatedActivityOf(ACCEPTED));
  });

  it("fails without settling while the chain cannot answer, so the check is retried", async () => {
    const { handler, activityService, deploymentWriterService } = setup();
    const undecidable = new Error("Chain has only reached an earlier block");
    deploymentWriterService.reconcileCreate.mockRejectedValue(undecidable);

    await expect(handler.handle(PAYLOAD)).rejects.toBe(undecidable);

    expect(activityService.settle).not.toHaveBeenCalled();
  });

  function setup(input: { pending?: boolean; createJob?: { completedOn: Date | null }; isCreateJobGone?: boolean; isCreated?: boolean } = {}) {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    onTestFinished(() => {
      vi.useRealTimers();
    });

    const activityService = mock<ActivityService>();
    activityService.isPending.mockResolvedValue(input.pending ?? true);
    const jobQueueService = mock<JobQueueService>();
    jobQueueService.findJob.mockResolvedValue(input.isCreateJobGone ? undefined : input.createJob ?? { completedOn: subMinutes(NOW, 20) });
    const deploymentWriterService = mock<DeploymentWriterService>();
    deploymentWriterService.reconcileCreate.mockResolvedValue(input.isCreated ?? false);

    const handler = new ReconcileDeploymentCreateHandler(activityService, jobQueueService, deploymentWriterService);

    return { handler, activityService, jobQueueService, deploymentWriterService };
  }
});
