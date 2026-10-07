import type { DeploymentHttpService } from "@akashnetwork/http-sdk";
import { addMinutes, addSeconds, subMinutes } from "date-fns";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ActivityService } from "@src/activity/services/activity/activity.service";
import type { JobQueueService } from "@src/core";
import { CloseDeployment } from "@src/deployment/services/close-deployment/close-deployment.job";
import { closedActivityOf, stillOpenActivityOf } from "@src/deployment/utils/close-activity/close-activity";
import { ReconcileDeploymentCloseHandler } from "./reconcile-deployment-close.handler";
import { ReconcileDeploymentClose } from "./reconcile-deployment-close.job";

import { createDeploymentInfoErrorSeed, createDeploymentInfoSeed } from "@test/seeders/deployment-info.seeder";

describe(ReconcileDeploymentCloseHandler.name, () => {
  const NOW = new Date("2026-10-07T12:00:00.000Z");
  const DATA = { userId: "user-1", owner: "akash1owner", dseq: "100", activityId: "activity-1", closeJobId: "job-1" };
  const PAYLOAD = { ...DATA, version: 1 as const };

  it("asks for no user's permission, since it only reads the activity and the deployment", () => {
    const { handler } = setup();

    expect(handler.requiresPermission()).toEqual([]);
  });

  it("leaves alone an activity its close already settled", async () => {
    const { handler, activityService, jobQueueService, deploymentHttpService } = setup({ pending: false });

    await handler.handle(PAYLOAD);

    expect(jobQueueService.findJob).not.toHaveBeenCalled();
    expect(deploymentHttpService.findByOwnerAndDseq).not.toHaveBeenCalled();
    expect(activityService.settle).not.toHaveBeenCalled();
  });

  it("checks again later, with the same retries, while the close job has not finished", async () => {
    const { handler, activityService, jobQueueService, deploymentHttpService } = setup({ closeJob: { completedOn: null } });

    await handler.handle(PAYLOAD);

    expect(jobQueueService.findJob).toHaveBeenCalledWith(CloseDeployment, "job-1");
    expect(jobQueueService.enqueue).toHaveBeenCalledWith(new ReconcileDeploymentClose(DATA), {
      startAfter: addMinutes(NOW, 5).toISOString(),
      retryLimit: 12,
      retryBackoff: true,
      retryDelay: 30,
      retryDelayMax: 300
    });
    expect(deploymentHttpService.findByOwnerAndDseq).not.toHaveBeenCalled();
    expect(activityService.settle).not.toHaveBeenCalled();
  });

  it("checks again later when the close job finished too recently for what it sent to have landed or expired", async () => {
    const { handler, activityService, jobQueueService, deploymentHttpService } = setup({ closeJob: { completedOn: addSeconds(subMinutes(NOW, 5), 1) } });

    await handler.handle(PAYLOAD);

    expect(jobQueueService.enqueue).toHaveBeenCalledWith(
      new ReconcileDeploymentClose(DATA),
      expect.objectContaining({ startAfter: addMinutes(NOW, 5).toISOString() })
    );
    expect(deploymentHttpService.findByOwnerAndDseq).not.toHaveBeenCalled();
    expect(activityService.settle).not.toHaveBeenCalled();
  });

  it("reads the deployment of the owner the close was for once its job has been over long enough", async () => {
    const { handler, jobQueueService, deploymentHttpService } = setup({ closeJob: { completedOn: subMinutes(NOW, 5) } });

    await handler.handle(PAYLOAD);

    expect(deploymentHttpService.findByOwnerAndDseq).toHaveBeenCalledWith("akash1owner", "100");
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
  });

  it("records the close as succeeded when the deployment is closed", async () => {
    const { handler, activityService } = setup({ deploymentState: "closed" });

    await handler.handle(PAYLOAD);

    expect(activityService.settle).toHaveBeenCalledWith("activity-1", closedActivityOf(DATA));
  });

  it("records the close as failed when the deployment is still open", async () => {
    const { handler, activityService } = setup({ deploymentState: "active" });

    await handler.handle(PAYLOAD);

    expect(activityService.settle).toHaveBeenCalledWith("activity-1", stillOpenActivityOf(DATA));
  });

  it("reads the deployment once pg-boss no longer keeps the close job", async () => {
    const { handler, activityService } = setup({ isCloseJobGone: true, deploymentState: "closed" });

    await handler.handle(PAYLOAD);

    expect(activityService.settle).toHaveBeenCalledWith("activity-1", closedActivityOf(DATA));
  });

  it("keeps the bulk close the close was part of in the activity it settles", async () => {
    const { handler, activityService } = setup({ deploymentState: "active" });
    const batchId = "b47c4a2e-5f0d-4c1e-9a7b-2d3e4f5a6b7c";

    await handler.handle({ ...PAYLOAD, batchId });

    expect(activityService.settle).toHaveBeenCalledWith("activity-1", stillOpenActivityOf({ ...DATA, batchId }));
  });

  it("fails without settling when the deployment cannot be read, so the read is retried", async () => {
    const { handler, activityService, deploymentHttpService } = setup();
    deploymentHttpService.findByOwnerAndDseq.mockResolvedValue(createDeploymentInfoErrorSeed({ code: 13, message: "node is catching up" }));

    await expect(handler.handle(PAYLOAD)).rejects.toThrow("node is catching up");

    expect(activityService.settle).not.toHaveBeenCalled();
  });

  function setup(input: { pending?: boolean; closeJob?: { completedOn: Date | null }; isCloseJobGone?: boolean; deploymentState?: string } = {}) {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    onTestFinished(() => {
      vi.useRealTimers();
    });

    const activityService = mock<ActivityService>();
    activityService.isPending.mockResolvedValue(input.pending ?? true);
    const jobQueueService = mock<JobQueueService>();
    jobQueueService.findJob.mockResolvedValue(input.isCloseJobGone ? undefined : input.closeJob ?? { completedOn: subMinutes(NOW, 10) });
    const deploymentHttpService = mock<DeploymentHttpService>();
    deploymentHttpService.findByOwnerAndDseq.mockResolvedValue(
      createDeploymentInfoSeed({ owner: DATA.owner, dseq: DATA.dseq, state: input.deploymentState ?? "active" })
    );

    const handler = new ReconcileDeploymentCloseHandler(activityService, jobQueueService, deploymentHttpService);

    return { handler, activityService, jobQueueService, deploymentHttpService };
  }
});
