import { addMinutes, subHours } from "date-fns";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import { JOB_NAME, type JobQueueService } from "@src/core";
import type { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";
import type { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { DetectLeaseGpus, detectLeaseGpusKeyFor, LeaseGpuDetectionJobService } from "./lease-gpu-detection-job.service";

const TARGET = { walletId: 7, dseq: "12345" };
const OWNER = "akash1owner";

type LiveManaged = Awaited<ReturnType<DeploymentSettingRepository["findLiveManagedDeployments"]>>[number];

function liveManaged(overrides: Partial<LiveManaged> = {}): LiveManaged {
  return {
    userId: "user-1",
    dseq: TARGET.dseq,
    walletId: TARGET.walletId,
    address: OWNER,
    createdAt: new Date(),
    hasDetectedGpus: false,
    hasOfferedGpus: false,
    ...overrides
  };
}

describe(LeaseGpuDetectionJobService.name, () => {
  describe("scheduleInitial", () => {
    it("enqueues nothing while the feature is off", async () => {
      const { service, jobQueueService } = setup({ enabled: false });

      await expect(service.scheduleInitial({ ...TARGET, leaseCreatedAt: new Date() })).resolves.toBeNull();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("holds one job per deployment and starts it at the first rung of the ladder", async () => {
      const { service, jobQueueService } = setup({});
      const leaseCreatedAt = new Date();

      await service.scheduleInitial({ ...TARGET, leaseCreatedAt });

      expect(jobQueueService.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ data: { ...TARGET, attempt: 1, leaseCreatedAt: leaseCreatedAt.toISOString() } }),
        { singletonKey: detectLeaseGpusKeyFor(TARGET), startAfter: addMinutes(leaseCreatedAt, 3) }
      );
    });
  });

  describe("scheduleNext", () => {
    it("moves to the next rung of the ladder", async () => {
      const { service, jobQueueService } = setup({});
      const leaseCreatedAt = new Date();

      await service.scheduleNext({ ...TARGET, attempt: 1, leaseCreatedAt: leaseCreatedAt.toISOString() });

      expect(jobQueueService.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ attempt: 2 }) }),
        expect.objectContaining({ startAfter: addMinutes(leaseCreatedAt, 15) })
      );
    });

    it("gives up once the ladder is spent rather than reading forever", async () => {
      const { service, jobQueueService } = setup({});

      await expect(service.scheduleNext({ ...TARGET, attempt: 3, leaseCreatedAt: new Date().toISOString() })).resolves.toBeNull();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });
  });

  describe("restartForUpdatedDeployment", () => {
    it("drops the pending read before queueing the one that replaces it", async () => {
      const { service, jobQueueService } = setup({});

      await service.restartForUpdatedDeployment({ ...TARGET, updatedAt: new Date() });

      expect(jobQueueService.cancelCreatedBy.mock.invocationCallOrder[0]).toBeLessThan(jobQueueService.enqueue.mock.invocationCallOrder[0]);
      expect(jobQueueService.cancelCreatedBy).toHaveBeenCalledWith({ name: DetectLeaseGpus[JOB_NAME], singletonKey: detectLeaseGpusKeyFor(TARGET) });
    });

    it("restarts the ladder from the update rather than from the original lease", async () => {
      const { service, jobQueueService } = setup({});
      const updatedAt = new Date();

      await service.restartForUpdatedDeployment({ ...TARGET, updatedAt });

      expect(jobQueueService.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ attempt: 1, leaseCreatedAt: updatedAt.toISOString() }) }),
        expect.objectContaining({ startAfter: addMinutes(updatedAt, 3) })
      );
    });

    it("cancels nothing while the feature is off", async () => {
      const { service, jobQueueService } = setup({ enabled: false });

      await expect(service.restartForUpdatedDeployment({ ...TARGET, updatedAt: new Date() })).resolves.toBeNull();
      expect(jobQueueService.cancelCreatedBy).not.toHaveBeenCalled();
    });
  });

  describe("reconcile", () => {
    it("schedules a gpu deployment nothing has read yet", async () => {
      const { service, jobQueueService } = setup({ candidates: [liveManaged()], onGpu: [{ owner: OWNER, dseq: TARGET.dseq }] });

      await expect(service.reconcile()).resolves.toMatchObject({ scheduled: 1 });
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ singletonKey: detectLeaseGpusKeyFor(TARGET) }));
    });

    it("leaves a deployment holding no gpu lease alone", async () => {
      const { service, jobQueueService } = setup({ candidates: [liveManaged()], onGpu: [] });

      await expect(service.reconcile()).resolves.toMatchObject({ scheduled: 0 });
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("leaves a deployment whose read is already queued alone", async () => {
      const { service, jobQueueService } = setup({
        candidates: [liveManaged()],
        onGpu: [{ owner: OWNER, dseq: TARGET.dseq }],
        pending: [detectLeaseGpusKeyFor(TARGET)]
      });

      await expect(service.reconcile()).resolves.toMatchObject({ scheduled: 0, alreadyScheduled: 1 });
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("leaves a deployment already read alone", async () => {
      const { service, jobQueueService } = setup({ candidates: [liveManaged({ hasDetectedGpus: true })], onGpu: [{ owner: OWNER, dseq: TARGET.dseq }] });

      await expect(service.reconcile()).resolves.toMatchObject({ scheduled: 0, alreadyRead: 1 });
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("backs off a deployment whose ladder finished within the backoff without a reading", async () => {
      const { service, jobQueueService } = setup({
        candidates: [liveManaged()],
        onGpu: [{ owner: OWNER, dseq: TARGET.dseq }],
        recentlyTried: [detectLeaseGpusKeyFor(TARGET)]
      });
      const earliest = subHours(new Date(), 24).getTime();

      await expect(service.reconcile()).resolves.toMatchObject({ scheduled: 0, recentlyTried: 1 });

      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
      const [{ name, since }] = jobQueueService.findRecentlyFinishedSingletonKeys.mock.calls[0];
      expect(name).toBe(DetectLeaseGpus[JOB_NAME]);
      expect(since.getTime()).toBeGreaterThanOrEqual(earliest);
      expect(since.getTime()).toBeLessThanOrEqual(subHours(new Date(), 24).getTime());
    });

    it("keeps going past a deployment it failed to schedule", async () => {
      const failing = liveManaged({ dseq: "111", walletId: 8 });
      const healthy = liveManaged({ dseq: "222", walletId: 9 });
      const { service, jobQueueService } = setup({
        candidates: [failing, healthy],
        onGpu: [
          { owner: OWNER, dseq: "111" },
          { owner: OWNER, dseq: "222" }
        ]
      });
      jobQueueService.enqueue.mockImplementation(async (_job, options) => {
        if (options?.singletonKey === detectLeaseGpusKeyFor(failing)) throw new Error("queue unavailable");
        return "job-id";
      });

      await expect(service.reconcile()).resolves.toMatchObject({ scheduled: 1, failed: 1 });

      expect(jobQueueService.enqueue).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ singletonKey: detectLeaseGpusKeyFor(healthy) }));
    });

    it("changes nothing on a dry run", async () => {
      const { service, jobQueueService } = setup({ candidates: [liveManaged()], onGpu: [{ owner: OWNER, dseq: TARGET.dseq }] });

      await expect(service.reconcile({ dryRun: true })).resolves.toMatchObject({ scheduled: 1 });
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("does nothing at all while the feature is off", async () => {
      const { service, jobQueueService } = setup({
        enabled: false,
        candidates: [liveManaged()],
        onGpu: [{ owner: OWNER, dseq: TARGET.dseq }]
      });

      await expect(service.reconcile()).resolves.toEqual({ scheduled: 0, alreadyScheduled: 0, alreadyRead: 0, recentlyTried: 0, failed: 0 });
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });
  });

  describe("startAfterFor", () => {
    it("lands after now for a lease old enough that its rung is already past", () => {
      const { service } = setup({});
      const before = new Date();

      const startAfter = service.startAfterFor({ ...TARGET, attempt: 1, leaseCreatedAt: subHours(new Date(), 5).toISOString() });

      expect(startAfter.getTime()).toBeGreaterThan(before.getTime());
    });

    it("stays on the last rung for an attempt past the end of the ladder", () => {
      const { service } = setup({});
      const leaseCreatedAt = new Date();

      const startAfter = service.startAfterFor({ ...TARGET, attempt: 9, leaseCreatedAt: leaseCreatedAt.toISOString() });

      expect(startAfter).toEqual(addMinutes(leaseCreatedAt, 60));
    });
  });

  function setup(input: {
    enabled?: boolean;
    delays?: number[];
    candidates?: LiveManaged[];
    onGpu?: Array<{ owner: string; dseq: string }>;
    pending?: string[];
    recentlyTried?: string[];
  }) {
    const jobQueueService = mock<JobQueueService>();
    jobQueueService.enqueue.mockResolvedValue("job-id");
    jobQueueService.findPendingSingletonKeys.mockResolvedValue(new Set(input.pending ?? []));
    jobQueueService.findRecentlyFinishedSingletonKeys.mockResolvedValue(new Set(input.recentlyTried ?? []));
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    deploymentSettingRepository.findLiveManagedDeployments.mockResolvedValue(input.candidates ?? []);
    const leaseRepository = mock<LeaseRepository>();
    leaseRepository.findLiveGpuLeaseDeployments.mockResolvedValue(input.onGpu ?? []);
    const config = mock<DeploymentConfigService>();
    config.get.mockImplementation((key: string) => {
      if (key === "LEASE_GPU_DETECTION_ENABLED") return input.enabled === false ? "false" : "true";
      if (key === "LEASE_GPU_DETECTION_DELAYS_MIN") return input.delays ?? [3, 15, 60];
      if (key === "LEASE_GPU_DETECTION_RECONCILE_MAX_AGE_HOURS") return 720;
      if (key === "LEASE_GPU_DETECTION_RECONCILE_BACKOFF_HOURS") return 24;
      return undefined;
    });
    const logger = mock<ReturnType<CreateLogger>>();
    const service = new LeaseGpuDetectionJobService(
      jobQueueService,
      deploymentSettingRepository,
      leaseRepository,
      config,
      vi.fn<CreateLogger>(() => logger)
    );

    return { service, jobQueueService, config };
  }
});
