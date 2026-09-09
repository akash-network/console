import { subMinutes } from "date-fns";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger, JobQueueService } from "@src/core";
import type { WorkloadAbuseDetectionRepository } from "@src/workload-abuse/repositories/workload-abuse-detection/workload-abuse-detection.repository";
import { EnforceTrialAbuse, enforceTrialAbuseKeyFor } from "@src/workload-abuse/services/enforce-trial-abuse/enforce-trial-abuse.handler";
import type { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import { TrialAbuseEnforcementJobService } from "./trial-abuse-enforcement-job.service";

import { mockConfigService } from "@test/mocks/config-service.mock";

const NOW = new Date("2026-01-01T12:00:00.000Z");
const STALLED = [
  { walletId: 1, detectionId: "detection-1" },
  { walletId: 2, detectionId: "detection-2" }
];

describe(TrialAbuseEnforcementJobService.name, () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("queues nothing while enforcement is in detect mode", async () => {
    const { service, detectionRepository, jobQueueService, logger } = setup({ mode: "detect" });

    await service.reconcile({ dryRun: false });

    expect(detectionRepository.findStalledEnforcements).not.toHaveBeenCalled();
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith({ event: "TRIAL_WORKLOAD_ABUSE_ENFORCEMENT_RECONCILE_SKIPPED", reason: "DETECT_MODE" });
  });

  it("queues nothing on a dry run", async () => {
    const { service, jobQueueService, logger } = setup({});

    await service.reconcile({ dryRun: true });

    expect(jobQueueService.findPendingSingletonKeys).not.toHaveBeenCalled();
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith({ event: "TRIAL_WORKLOAD_ABUSE_ENFORCEMENT_RECONCILE_START", count: 2, dryRun: true });
  });

  it("looks for wipes whose last state change is more than an hour old", async () => {
    const { service, detectionRepository } = setup({});

    await service.reconcile({ dryRun: false });

    expect(detectionRepository.findStalledEnforcements).toHaveBeenCalledWith({ updatedBefore: subMinutes(NOW, 60) });
  });

  it("queues the wipe again only for wallets without one already pending", async () => {
    const { service, jobQueueService, logger } = setup({ pendingKeys: [enforceTrialAbuseKeyFor(1)] });

    await service.reconcile({ dryRun: false });

    expect(jobQueueService.enqueue).toHaveBeenCalledTimes(1);
    expect(jobQueueService.enqueue).toHaveBeenCalledWith(new EnforceTrialAbuse({ walletId: 2, detectionId: "detection-2" }), {
      singletonKey: enforceTrialAbuseKeyFor(2)
    });
    expect(logger.info).toHaveBeenCalledWith({
      event: "TRIAL_WORKLOAD_ABUSE_ENFORCEMENT_RECONCILE_END",
      found: 2,
      requeued: 1,
      alreadyQueued: 1,
      failed: 0
    });
  });

  it("counts a wipe the queue refused as already queued", async () => {
    const { service, jobQueueService, logger } = setup({});
    jobQueueService.enqueue.mockResolvedValueOnce(null);

    await service.reconcile({ dryRun: false });

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: "TRIAL_WORKLOAD_ABUSE_ENFORCEMENT_RECONCILE_END", requeued: 1, alreadyQueued: 1 })
    );
  });

  it("goes on with the other wallets when one wipe cannot be queued", async () => {
    const { service, jobQueueService, logger } = setup({});
    const error = new Error("queue down");
    jobQueueService.enqueue.mockRejectedValueOnce(error);

    await service.reconcile({ dryRun: false });

    expect(jobQueueService.enqueue).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith({ event: "TRIAL_WORKLOAD_ABUSE_ENFORCEMENT_RECONCILE_FAILED", walletId: 1, detectionId: "detection-1", error });
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "TRIAL_WORKLOAD_ABUSE_ENFORCEMENT_RECONCILE_END", requeued: 1, failed: 1 }));
  });

  function setup(input: { mode?: "detect" | "enforce"; stalled?: Array<{ walletId: number; detectionId: string }>; pendingKeys?: string[] }) {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });

    const jobQueueService = mock<JobQueueService>();
    jobQueueService.enqueue.mockResolvedValue("job-id");
    jobQueueService.findPendingSingletonKeys.mockResolvedValue(new Set(input.pendingKeys ?? []));
    const detectionRepository = mock<WorkloadAbuseDetectionRepository>();
    detectionRepository.findStalledEnforcements.mockResolvedValue(input.stalled ?? STALLED);
    const config = mockConfigService<WorkloadAbuseConfigService>({ WORKLOAD_ABUSE_ENFORCEMENT_MODE: input.mode ?? "enforce" });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const service = new TrialAbuseEnforcementJobService(jobQueueService, detectionRepository, config, createLogger);

    return { service, jobQueueService, detectionRepository, logger };
  }
});
