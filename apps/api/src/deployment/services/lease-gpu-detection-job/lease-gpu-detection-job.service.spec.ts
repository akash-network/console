import { addMinutes, subHours } from "date-fns";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import { JOB_NAME, type JobQueueService } from "@src/core";
import type { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { DetectLeaseGpus, detectLeaseGpusKeyFor, LeaseGpuDetectionJobService } from "./lease-gpu-detection-job.service";

const TARGET = { walletId: 7, dseq: "12345" };

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

  function setup(input: { enabled?: boolean; delays?: number[] }) {
    const jobQueueService = mock<JobQueueService>();
    jobQueueService.enqueue.mockResolvedValue("job-id");
    const config = mock<DeploymentConfigService>();
    config.get.mockImplementation((key: string) => {
      if (key === "LEASE_GPU_DETECTION_ENABLED") return input.enabled === false ? "false" : "true";
      if (key === "LEASE_GPU_DETECTION_DELAYS_MIN") return input.delays ?? [3, 15, 60];
      return undefined;
    });
    const logger = mock<ReturnType<CreateLogger>>();
    const service = new LeaseGpuDetectionJobService(jobQueueService, config, vi.fn<CreateLogger>(() => logger));

    return { service, jobQueueService, config };
  }
});
