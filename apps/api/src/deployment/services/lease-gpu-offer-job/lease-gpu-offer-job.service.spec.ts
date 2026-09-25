import { subHours } from "date-fns";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import { JOB_NAME, type JobQueueService } from "@src/core";
import type { DeploymentSettingRepository, LiveManagedDeployment } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";
import type { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { LeaseGpuOfferJobService, RecordLeaseGpuOffers, recordLeaseGpuOffersKeyFor } from "./lease-gpu-offer-job.service";

const TARGET = { walletId: 7, dseq: "12345" };
const OWNER = "akash1owner";

function liveManaged(overrides: Partial<LiveManagedDeployment> = {}): LiveManagedDeployment {
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

describe(LeaseGpuOfferJobService.name, () => {
  describe("schedule", () => {
    it("holds one job per deployment and starts it right away", async () => {
      const { service, jobQueueService } = setup({});

      await expect(service.schedule(TARGET)).resolves.toBe("job-id");

      expect(jobQueueService.enqueue).toHaveBeenCalledWith(expect.objectContaining({ name: RecordLeaseGpuOffers[JOB_NAME], data: TARGET }), {
        singletonKey: recordLeaseGpuOffersKeyFor(TARGET)
      });
    });
  });

  describe("reconcile", () => {
    it("schedules a live gpu deployment that has no offer recorded", async () => {
      const { service, jobQueueService } = setup({ candidates: [liveManaged()], onGpu: [{ owner: OWNER, dseq: TARGET.dseq }] });

      await expect(service.reconcile()).resolves.toEqual({ scheduled: 1, alreadyScheduled: 0, recentlyTried: 0, failed: 0 });
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(expect.objectContaining({ data: TARGET }), { singletonKey: recordLeaseGpuOffersKeyFor(TARGET) });
    });

    it("asks the chain index about each owner once, however many of their deployments are candidates", async () => {
      const { service, leaseRepository } = setup({ candidates: [liveManaged({ dseq: "111" }), liveManaged({ dseq: "222" })], onGpu: [] });

      await service.reconcile();

      expect(leaseRepository.findLiveGpuLeaseDeployments).toHaveBeenCalledWith([OWNER]);
    });

    it("leaves a deployment whose offer is already recorded alone, and asks the chain index nothing about its owner", async () => {
      const { service, jobQueueService, leaseRepository } = setup({
        candidates: [liveManaged({ hasOfferedGpus: true })],
        onGpu: [{ owner: OWNER, dseq: TARGET.dseq }]
      });

      await expect(service.reconcile()).resolves.toMatchObject({ scheduled: 0 });
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
      expect(leaseRepository.findLiveGpuLeaseDeployments).toHaveBeenCalledWith([]);
    });

    it("leaves a deployment with no live gpu lease alone", async () => {
      const { service, jobQueueService } = setup({ candidates: [liveManaged()], onGpu: [] });

      await expect(service.reconcile()).resolves.toMatchObject({ scheduled: 0 });
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("tells a gpu lease apart by its owner as well as its dseq", async () => {
      const { service, jobQueueService } = setup({ candidates: [liveManaged()], onGpu: [{ owner: "akash1other", dseq: TARGET.dseq }] });

      await service.reconcile();

      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("counts a deployment already queued rather than queueing it again", async () => {
      const { service, jobQueueService } = setup({
        candidates: [liveManaged()],
        onGpu: [{ owner: OWNER, dseq: TARGET.dseq }],
        pending: [recordLeaseGpuOffersKeyFor(TARGET)]
      });

      await expect(service.reconcile()).resolves.toMatchObject({ scheduled: 0, alreadyScheduled: 1 });
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("waits out the backoff for a deployment recorded or tried recently", async () => {
      const { service, jobQueueService } = setup({
        candidates: [liveManaged()],
        onGpu: [{ owner: OWNER, dseq: TARGET.dseq }],
        recentlyTried: [recordLeaseGpuOffersKeyFor(TARGET)]
      });

      await expect(service.reconcile()).resolves.toMatchObject({ scheduled: 0, recentlyTried: 1 });
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("looks back over the configured backoff for recently finished jobs", async () => {
      const { service, jobQueueService } = setup({ candidates: [], onGpu: [] });
      const earliest = subHours(new Date(), 24).getTime();

      await service.reconcile();

      const [{ name, since }] = jobQueueService.findRecentlyFinishedSingletonKeys.mock.calls[0];
      expect(name).toBe(RecordLeaseGpuOffers[JOB_NAME]);
      expect(since.getTime()).toBeGreaterThanOrEqual(earliest);
      expect(since.getTime()).toBeLessThanOrEqual(subHours(new Date(), 24).getTime());
      expect(jobQueueService.findPendingSingletonKeys).toHaveBeenCalledWith(RecordLeaseGpuOffers[JOB_NAME]);
    });

    it("sweeps no further back than the configured age", async () => {
      const { service, deploymentSettingRepository } = setup({ candidates: [], onGpu: [] });

      await service.reconcile();

      expect(deploymentSettingRepository.findLiveManagedDeployments).toHaveBeenCalledWith({ maxAgeHours: 720 });
    });

    it("keeps going past a deployment it failed to schedule", async () => {
      const failing = liveManaged({ dseq: "111", walletId: 8 });
      const healthy = liveManaged({ dseq: "222", walletId: 9 });
      const { service, jobQueueService, logger } = setup({
        candidates: [failing, healthy],
        onGpu: [
          { owner: OWNER, dseq: "111" },
          { owner: OWNER, dseq: "222" }
        ]
      });
      jobQueueService.enqueue.mockImplementation(async (_job, options) => {
        if (options?.singletonKey === recordLeaseGpuOffersKeyFor(failing)) throw new Error("queue unavailable");
        return "job-id";
      });

      await expect(service.reconcile()).resolves.toMatchObject({ scheduled: 1, failed: 1 });

      expect(jobQueueService.enqueue).toHaveBeenCalledWith(expect.anything(), { singletonKey: recordLeaseGpuOffersKeyFor(healthy) });
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "LEASE_GPU_OFFERS_RECONCILE_FAILED", walletId: 8, dseq: "111" }));
    });

    it("changes nothing on a dry run", async () => {
      const { service, jobQueueService } = setup({ candidates: [liveManaged()], onGpu: [{ owner: OWNER, dseq: TARGET.dseq }] });

      await expect(service.reconcile({ dryRun: true })).resolves.toMatchObject({ scheduled: 1 });
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("runs whether or not the gpu probe is enabled", async () => {
      const { service, jobQueueService, config } = setup({ candidates: [liveManaged()], onGpu: [{ owner: OWNER, dseq: TARGET.dseq }] });

      await service.reconcile();

      expect(jobQueueService.enqueue).toHaveBeenCalled();
      expect(config.get).not.toHaveBeenCalledWith("LEASE_GPU_DETECTION_ENABLED");
    });
  });

  function setup(input: {
    candidates?: LiveManagedDeployment[];
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
      if (key === "LEASE_GPU_DETECTION_RECONCILE_MAX_AGE_HOURS") return 720;
      if (key === "LEASE_GPU_DETECTION_RECONCILE_BACKOFF_HOURS") return 24;
      return undefined;
    });
    const logger = mock<ReturnType<CreateLogger>>();
    const service = new LeaseGpuOfferJobService(
      jobQueueService,
      deploymentSettingRepository,
      leaseRepository,
      config,
      vi.fn<CreateLogger>(() => logger)
    );

    return { service, jobQueueService, deploymentSettingRepository, leaseRepository, config, logger };
  }
});
