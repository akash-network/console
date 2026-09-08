import { addMinutes, subHours } from "date-fns";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger, JobQueueService } from "@src/core";
import type { DeploymentSettingRepository, LiveTrialDeployment } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { WorkloadAbuseDetectionRepository } from "@src/workload-abuse/repositories/workload-abuse-detection/workload-abuse-detection.repository";
import type { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import { ProbeTrialDeployment, probeTrialDeploymentKeyFor, TrialWorkloadProbeJobService } from "./trial-workload-probe-job.service";

import { mockConfigService } from "@test/mocks/config-service.mock";

const LEASE_CREATED_AT = new Date("2026-01-01T12:00:00.000Z");
const TARGET = { walletId: 42, dseq: "1000001" };

describe(TrialWorkloadProbeJobService.name, () => {
  describe("scheduleInitial", () => {
    it("enqueues nothing while probing is disabled", async () => {
      const { service, jobQueueService } = setup({ enabled: false });

      expect(await service.scheduleInitial({ ...TARGET, leaseCreatedAt: LEASE_CREATED_AT })).toBeNull();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("enqueues the first attempt keyed by deployment at the first delay after the lease", async () => {
      const { service, jobQueueService } = setup({ now: LEASE_CREATED_AT });

      await service.scheduleInitial({ ...TARGET, leaseCreatedAt: LEASE_CREATED_AT });

      expect(jobQueueService.enqueue).toHaveBeenCalledWith(
        new ProbeTrialDeployment({ ...TARGET, attempt: 1, leaseCreatedAt: LEASE_CREATED_AT.toISOString() }),
        {
          singletonKey: probeTrialDeploymentKeyFor(TARGET),
          startAfter: addMinutes(LEASE_CREATED_AT, 5).toISOString()
        }
      );
    });
  });

  describe("scheduleNext", () => {
    it("enqueues the following attempt under the same key", async () => {
      const { service, jobQueueService } = setup({ now: LEASE_CREATED_AT });

      await service.scheduleNext({ ...TARGET, attempt: 1, leaseCreatedAt: LEASE_CREATED_AT.toISOString() });

      expect(jobQueueService.enqueue).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ attempt: 2 }) }), {
        singletonKey: probeTrialDeploymentKeyFor(TARGET),
        startAfter: addMinutes(LEASE_CREATED_AT, 20).toISOString()
      });
    });
  });

  describe("startAfterFor", () => {
    it("places the first attempts at fixed offsets from the lease", () => {
      const { service } = setup({});
      const data = { leaseCreatedAt: LEASE_CREATED_AT.toISOString() };

      expect(service.startAfterFor({ ...data, attempt: 1 }, LEASE_CREATED_AT)).toEqual(addMinutes(LEASE_CREATED_AT, 5));
      expect(service.startAfterFor({ ...data, attempt: 3 }, LEASE_CREATED_AT)).toEqual(addMinutes(LEASE_CREATED_AT, 60));
    });

    it("runs an overdue attempt now rather than in the past", () => {
      const { service } = setup({});
      const now = addMinutes(LEASE_CREATED_AT, 90);

      expect(service.startAfterFor({ attempt: 1, leaseCreatedAt: LEASE_CREATED_AT.toISOString() }, now)).toEqual(now);
    });

    it("spreads later attempts around the interval with jitter", () => {
      const { service } = setup({});
      const now = new Date("2026-09-06T15:00:00.000Z");

      const startAfter = service.startAfterFor({ attempt: 4, leaseCreatedAt: LEASE_CREATED_AT.toISOString() }, now);

      expect(startAfter.getTime()).toBeGreaterThanOrEqual(addMinutes(now, 50).getTime());
      expect(startAfter.getTime()).toBeLessThanOrEqual(addMinutes(now, 70).getTime());
    });
  });

  describe("cancelForDeployment", () => {
    it("cancels the pending probe under the deployment key", async () => {
      const { service, jobQueueService } = setup({});

      await service.cancelForDeployment(TARGET);

      expect(jobQueueService.cancelCreatedBy).toHaveBeenCalledWith({ name: "ProbeTrialDeployment", singletonKey: probeTrialDeploymentKeyFor(TARGET) });
    });
  });

  describe("cancelForWallet", () => {
    it("cancels every pending probe of the wallet and none of another wallet", async () => {
      const { service, jobQueueService } = setup({ pendingKeys: ["probeTrialDeployment.7.1", "probeTrialDeployment.7.2", "probeTrialDeployment.70.3"] });

      const cancelled = await service.cancelForWallet(7);

      expect(cancelled).toBe(2);
      expect(jobQueueService.cancelCreatedBy).toHaveBeenCalledTimes(2);
      expect(jobQueueService.cancelCreatedBy).toHaveBeenCalledWith({ name: "ProbeTrialDeployment", singletonKey: "probeTrialDeployment.7.1" });
      expect(jobQueueService.cancelCreatedBy).toHaveBeenCalledWith({ name: "ProbeTrialDeployment", singletonKey: "probeTrialDeployment.7.2" });
    });
  });

  describe("reconcile", () => {
    const live: LiveTrialDeployment[] = [
      { userId: "u1", dseq: "1", walletId: 1, createdAt: LEASE_CREATED_AT },
      { userId: "u2", dseq: "2", walletId: 2, createdAt: LEASE_CREATED_AT }
    ];

    it("enqueues nothing on a dry run", async () => {
      const { service, jobQueueService } = setup({ live });

      await service.reconcile({ dryRun: true });

      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
      expect(jobQueueService.findPendingSingletonKeys).not.toHaveBeenCalled();
    });

    it("schedules an immediate first probe only for deployments with none pending", async () => {
      const { service, jobQueueService, logger } = setup({
        live,
        pendingKeys: [probeTrialDeploymentKeyFor({ walletId: 1, dseq: "1" })],
        now: LEASE_CREATED_AT
      });

      await service.reconcile({ dryRun: false });

      expect(jobQueueService.enqueue).toHaveBeenCalledTimes(1);
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(
        new ProbeTrialDeployment({ walletId: 2, dseq: "2", attempt: 1, leaseCreatedAt: LEASE_CREATED_AT.toISOString() }),
        {
          singletonKey: probeTrialDeploymentKeyFor({ walletId: 2, dseq: "2" }),
          startAfter: LEASE_CREATED_AT.toISOString()
        }
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: "TRIAL_WORKLOAD_PROBE_RECONCILE_END", found: 2, scheduled: 1, alreadyScheduled: 1, failed: 0 })
      );
    });

    it("leaves a deployment that already carries a confirmed detection alone", async () => {
      const { service, jobQueueService, detectionRepository, logger } = setup({ live, detected: [{ walletId: 1, dseq: "1" }], now: LEASE_CREATED_AT });

      await service.reconcile({ dryRun: false });

      expect(detectionRepository.findRecentHardTargets).toHaveBeenCalledWith({ since: subHours(LEASE_CREATED_AT, 26) });
      expect(jobQueueService.enqueue).toHaveBeenCalledTimes(1);
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ walletId: 2, dseq: "2" }) }),
        expect.anything()
      );
      expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "TRIAL_WORKLOAD_PROBE_RECONCILE_END", scheduled: 1, alreadyDetected: 1 }));
    });

    it("skips the sweep while probing is disabled", async () => {
      const { service, deploymentSettingRepository } = setup({ enabled: false, live });

      await service.reconcile({ dryRun: false });

      expect(deploymentSettingRepository.findLiveTrialDeployments).not.toHaveBeenCalled();
    });
  });

  function setup(input: {
    enabled?: boolean;
    live?: LiveTrialDeployment[];
    pendingKeys?: string[];
    detected?: Array<{ walletId: number; dseq: string }>;
    now?: Date;
  }) {
    if (input.now) vi.useFakeTimers({ now: input.now, toFake: ["Date"] });
    else vi.useRealTimers();

    const jobQueueService = mock<JobQueueService>();
    jobQueueService.enqueue.mockResolvedValue("job-id");
    jobQueueService.findPendingSingletonKeys.mockResolvedValue(new Set(input.pendingKeys ?? []));
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    deploymentSettingRepository.findLiveTrialDeployments.mockResolvedValue(input.live ?? []);
    const detectionRepository = mock<WorkloadAbuseDetectionRepository>();
    detectionRepository.findRecentHardTargets.mockResolvedValue(input.detected ?? []);
    const config = mockConfigService<WorkloadAbuseConfigService>({
      WORKLOAD_ABUSE_PROBE_ENABLED: input.enabled ?? true,
      WORKLOAD_ABUSE_PROBE_INITIAL_DELAYS_MIN: [5, 20, 60],
      WORKLOAD_ABUSE_PROBE_INTERVAL_MIN: 60,
      WORKLOAD_ABUSE_PROBE_JITTER_MIN: 10,
      WORKLOAD_ABUSE_RECONCILE_MAX_AGE_HOURS: 26
    });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const service = new TrialWorkloadProbeJobService(jobQueueService, deploymentSettingRepository, detectionRepository, config, createLogger);

    return { service, jobQueueService, deploymentSettingRepository, detectionRepository, logger };
  }
});
