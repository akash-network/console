import { addMinutes, addSeconds, subMinutes } from "date-fns";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ActivityService } from "@src/activity/services/activity/activity.service";
import type { JobQueueService } from "@src/core";
import { CREATE_LEASE_RETRY_OPTIONS, CreateLease } from "@src/deployment/services/create-lease/create-lease.job";
import type { LeaseService } from "@src/deployment/services/lease/lease.service";
import { notCreatedLeaseActivityOf, undeliveredManifestActivityOf } from "@src/deployment/utils/lease-activity/lease-activity";
import { ReconcileLeaseCreateHandler } from "./reconcile-lease-create.handler";
import { ReconcileLeaseCreate } from "./reconcile-lease-create.job";

describe(ReconcileLeaseCreateHandler.name, () => {
  const NOW = new Date("2026-10-07T12:00:00.000Z");
  const LEASES = [{ dseq: "100", gseq: 1, oseq: 1, provider: "akash1provider" }];
  const DATA = { userId: "user-1", owner: "akash1owner", leases: LEASES, activityId: "activity-1", createLeaseJobId: "job-1" };
  const PAYLOAD = { ...DATA, version: 1 as const };
  const CHECK_AGAIN_OPTIONS = {
    singletonKey: "reconcileLeaseCreate.activity-1",
    startAfter: addMinutes(NOW, 5).toISOString(),
    retryLimit: 12,
    retryBackoff: true,
    retryDelay: 30,
    retryDelayMax: 300
  };

  it("asks for no user's permission, since it only reads the activity and the leases", () => {
    const { handler } = setup();

    expect(handler.requiresPermission()).toEqual([]);
  });

  it("keeps one waiting check per activity, so a run retried after queueing the next check queues no second one", () => {
    const { handler } = setup();

    expect(handler.policy).toBe("short");
  });

  it("leaves alone an activity its lease job already settled", async () => {
    const { handler, activityService, jobQueueService, leaseService } = setup({ pending: false });

    await handler.handle(PAYLOAD);

    expect(activityService.isPending).toHaveBeenCalledWith("activity-1");
    expect(jobQueueService.findJob).not.toHaveBeenCalled();
    expect(leaseService.leasesExist).not.toHaveBeenCalled();
    expect(activityService.settle).not.toHaveBeenCalled();
  });

  it("checks again later, with the same retries, while the lease job has not finished", async () => {
    const { handler, activityService, jobQueueService, leaseService } = setup({ createLeaseJob: { completedOn: null } });

    await handler.handle(PAYLOAD);

    expect(jobQueueService.findJob).toHaveBeenCalledWith(CreateLease, "job-1");
    expect(jobQueueService.enqueue).toHaveBeenCalledWith(new ReconcileLeaseCreate(DATA), CHECK_AGAIN_OPTIONS);
    expect(leaseService.leasesExist).not.toHaveBeenCalled();
    expect(activityService.settle).not.toHaveBeenCalled();
  });

  it("checks again later when the lease job finished too recently for what it sent to have landed or expired", async () => {
    const { handler, jobQueueService, leaseService } = setup({ createLeaseJob: { completedOn: addSeconds(subMinutes(NOW, 5), 1) } });

    await handler.handle(PAYLOAD);

    expect(jobQueueService.enqueue).toHaveBeenCalledWith(new ReconcileLeaseCreate(DATA), CHECK_AGAIN_OPTIONS);
    expect(leaseService.leasesExist).not.toHaveBeenCalled();
  });

  it("records the leases as not created when none landed once the lease job has been over long enough", async () => {
    const { handler, activityService, jobQueueService, leaseService } = setup({ createLeaseJob: { completedOn: subMinutes(NOW, 5) }, leasesExist: false });

    await handler.handle(PAYLOAD);

    expect(leaseService.leasesExist).toHaveBeenCalledWith("akash1owner", LEASES);
    expect(activityService.settle).toHaveBeenCalledWith("activity-1", notCreatedLeaseActivityOf(DATA));
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
  });

  it("reads the leases once pg-boss no longer keeps the lease job", async () => {
    const { handler, activityService } = setup({ isCreateLeaseJobGone: true, leasesExist: false });

    await handler.handle(PAYLOAD);

    expect(activityService.settle).toHaveBeenCalledWith("activity-1", notCreatedLeaseActivityOf(DATA));
  });

  it("queues the lease job again for leases that landed, so their manifest is sent, and checks on that job later", async () => {
    const { handler, activityService, jobQueueService } = setup({ leasesExist: true });
    jobQueueService.enqueue.mockResolvedValueOnce("job-2");

    await handler.handle(PAYLOAD);

    expect(jobQueueService.enqueue).toHaveBeenCalledWith(new CreateLease({ userId: "user-1", leases: LEASES, activityId: "activity-1" }), {
      singletonKey: "createLease.akash1owner.100",
      ...CREATE_LEASE_RETRY_OPTIONS
    });
    expect(jobQueueService.enqueue).toHaveBeenCalledWith(new ReconcileLeaseCreate({ ...DATA, createLeaseJobId: "job-2" }), CHECK_AGAIN_OPTIONS);
    expect(activityService.settle).not.toHaveBeenCalled();
  });

  it("checks again on the previous job while another lease job holds the deployment", async () => {
    const { handler, jobQueueService } = setup({ leasesExist: true });
    jobQueueService.enqueue.mockResolvedValueOnce(null);

    await handler.handle(PAYLOAD);

    expect(jobQueueService.enqueue).toHaveBeenLastCalledWith(new ReconcileLeaseCreate(DATA), CHECK_AGAIN_OPTIONS);
  });

  it.each([
    { outcome: "as not created when none landed", leasesExist: false, settled: notCreatedLeaseActivityOf },
    {
      outcome: "as missing its manifest when they landed, since the request that created them answered undecided",
      leasesExist: true,
      settled: undeliveredManifestActivityOf
    }
  ])("reads the leases of a request straight away and records them $outcome", async ({ leasesExist, settled }) => {
    const { handler, activityService, jobQueueService } = setup({ leasesExist });
    const { createLeaseJobId: _createLeaseJobId, ...requestLeases } = DATA;

    await handler.handle({ ...requestLeases, version: 1 });

    expect(jobQueueService.findJob).not.toHaveBeenCalled();
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    expect(activityService.settle).toHaveBeenCalledWith("activity-1", settled(requestLeases));
  });

  it("fails without settling when the leases cannot be read, so the read is retried", async () => {
    const { handler, activityService, leaseService } = setup();
    const readFailure = new Error("node is catching up");
    leaseService.leasesExist.mockRejectedValue(readFailure);

    await expect(handler.handle(PAYLOAD)).rejects.toBe(readFailure);

    expect(activityService.settle).not.toHaveBeenCalled();
  });

  function setup(input: { pending?: boolean; createLeaseJob?: { completedOn: Date | null }; isCreateLeaseJobGone?: boolean; leasesExist?: boolean } = {}) {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
    onTestFinished(() => {
      vi.useRealTimers();
    });

    const activityService = mock<ActivityService>();
    activityService.isPending.mockResolvedValue(input.pending ?? true);
    const jobQueueService = mock<JobQueueService>();
    jobQueueService.findJob.mockResolvedValue(input.isCreateLeaseJobGone ? undefined : input.createLeaseJob ?? { completedOn: subMinutes(NOW, 10) });
    const leaseService = mock<LeaseService>();
    leaseService.leasesExist.mockResolvedValue(input.leasesExist ?? false);

    const handler = new ReconcileLeaseCreateHandler(activityService, jobQueueService, leaseService);

    return { handler, activityService, jobQueueService, leaseService };
  }
});
