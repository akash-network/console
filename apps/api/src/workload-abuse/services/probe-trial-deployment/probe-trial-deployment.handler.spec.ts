import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UserWalletRepository } from "@src/billing/repositories";
import type { CreateLogger, JobQueueService } from "@src/core";
import type {
  WorkloadAbuseDetectionOutput,
  WorkloadAbuseDetectionRepository
} from "@src/workload-abuse/repositories/workload-abuse-detection/workload-abuse-detection.repository";
import { EnforceTrialAbuse } from "@src/workload-abuse/services/enforce-trial-abuse/enforce-trial-abuse.handler";
import type { ProbeReport, TrialWorkloadProbeService } from "@src/workload-abuse/services/trial-workload-probe/trial-workload-probe.service";
import type { TrialWorkloadProbeJobService } from "@src/workload-abuse/services/trial-workload-probe-job/trial-workload-probe-job.service";
import type { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import type { WorkloadAbuseInstrumentationService } from "@src/workload-abuse/services/workload-abuse-instrumentation/workload-abuse-instrumentation.service";
import { ProbeTrialDeploymentHandler } from "./probe-trial-deployment.handler";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

const PAYLOAD = { walletId: 42, dseq: "1000001", attempt: 2, leaseCreatedAt: "2026-01-01T12:00:00.000Z", version: 1 as const };

describe(ProbeTrialDeploymentHandler.name, () => {
  it("does nothing while probing is disabled", async () => {
    const { handler, probeService, probeJobService } = setup({ enabled: false });

    await handler.handle(PAYLOAD);

    expect(probeService.probe).not.toHaveBeenCalled();
    expect(probeJobService.scheduleNext).not.toHaveBeenCalled();
  });

  it("stops without rescheduling when the wallet is gone or no longer on trial", async () => {
    const { handler: missing, probeService: missingProbe } = setup({ wallet: null });
    const { handler: paying, probeService: payingProbe, probeJobService } = setup({ wallet: createUserWallet({ isTrialing: false }) });

    await missing.handle(PAYLOAD);
    await paying.handle(PAYLOAD);

    expect(missingProbe.probe).not.toHaveBeenCalled();
    expect(payingProbe.probe).not.toHaveBeenCalled();
    expect(probeJobService.scheduleNext).not.toHaveBeenCalled();
  });

  it("stops without rescheduling once the deployment has no live lease", async () => {
    const { handler, probeJobService, detectionRepository } = setup({ report: createReport({ probeStatus: "no_live_lease" }) });

    await handler.handle(PAYLOAD);

    expect(probeJobService.scheduleNext).not.toHaveBeenCalled();
    expect(detectionRepository.create).not.toHaveBeenCalled();
  });

  it("reschedules a clean probe and records nothing", async () => {
    const { handler, probeJobService, detectionRepository, instrumentation } = setup({ report: createReport({ verdict: "clean" }) });

    await handler.handle(PAYLOAD);

    expect(detectionRepository.create).not.toHaveBeenCalled();
    expect(probeJobService.scheduleNext).toHaveBeenCalledWith(PAYLOAD);
    expect(instrumentation.recordProbe).toHaveBeenCalledWith(expect.objectContaining({ verdict: "clean", probeStatus: "probed" }));
  });

  it("records a suspicious workload for review and keeps probing it", async () => {
    const report = createReport({ verdict: "soft" });
    const { handler, wallet, probeJobService, detectionRepository, logger } = setup({ report });

    await handler.handle(PAYLOAD);

    expect(detectionRepository.create).toHaveBeenCalledWith({
      userId: wallet.userId,
      walletId: wallet.id,
      dseq: PAYLOAD.dseq,
      provider: "akash1provider",
      verdict: "soft",
      probeStatus: "probed",
      signals: report.signals,
      evidenceExcerpt: report.excerpt
    });
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "TRIAL_WORKLOAD_SUSPICIOUS", detectionId: "detection-1" }));
    expect(probeJobService.scheduleNext).toHaveBeenCalledWith(PAYLOAD);
  });

  it("records confirmed mining and stops probing the deployment", async () => {
    const { handler, probeJobService, detectionRepository, instrumentation, logger } = setup({ report: createReport({ verdict: "hard" }) });

    await handler.handle(PAYLOAD);

    expect(detectionRepository.create).toHaveBeenCalledWith(expect.objectContaining({ verdict: "hard" }));
    expect(instrumentation.recordDetection).toHaveBeenCalledWith("hard");
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "TRIAL_WORKLOAD_ABUSE_DETECTED" }));
    expect(probeJobService.scheduleNext).not.toHaveBeenCalled();
  });

  it("skips a wallet that has already been locked for abuse", async () => {
    const { handler, probeService } = setup({ wallet: createUserWallet({ isTrialing: true, abuseLockedAt: new Date() }) });

    await handler.handle(PAYLOAD);

    expect(probeService.probe).not.toHaveBeenCalled();
  });

  it("only records confirmed mining while enforcement is in detect mode", async () => {
    const { handler, jobQueueService, logger } = setup({ report: createReport({ verdict: "hard" }), enforcementMode: "detect" });

    await handler.handle(PAYLOAD);

    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "TRIAL_WORKLOAD_ABUSE_ENFORCEMENT_DEFERRED", detectionId: "detection-1" }));
  });

  it("queues the wallet wipe for confirmed mining in enforce mode", async () => {
    const { handler, wallet, jobQueueService } = setup({ report: createReport({ verdict: "hard" }), enforcementMode: "enforce" });

    await handler.handle(PAYLOAD);

    expect(jobQueueService.enqueue).toHaveBeenCalledWith(new EnforceTrialAbuse({ walletId: wallet.id, detectionId: "detection-1" }), {
      singletonKey: `enforceTrialAbuse.${wallet.id}`
    });
  });

  it("stops after the last allowed attempt", async () => {
    const { handler, probeJobService } = setup({ report: createReport({ verdict: "clean" }), maxAttempts: 2 });

    await handler.handle(PAYLOAD);

    expect(probeJobService.scheduleNext).not.toHaveBeenCalled();
  });

  function createReport(overrides: Partial<ProbeReport>): ProbeReport {
    return {
      verdict: "clean",
      signals: [{ bucket: "soft", category: "pool-port", source: "shell", service: "ssh", snippet: "pool:3333" }],
      excerpt: "[soft/pool-port] shell:ssh: pool:3333",
      probeStatus: "probed",
      leases: [
        {
          provider: "akash1provider",
          hostUri: "https://provider.example",
          gseq: 1,
          oseq: 1,
          services: ["ssh"],
          shellStatuses: ["completed"],
          logStatus: "completed"
        }
      ],
      ...overrides
    };
  }

  it("stops probing a deployment that already carries a confirmed detection", async () => {
    const { handler, probeService, probeJobService, logger } = setup({ existingDetection: true });

    await handler.handle(PAYLOAD);

    expect(probeService.probe).not.toHaveBeenCalled();
    expect(probeJobService.scheduleNext).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: "TRIAL_WORKLOAD_PROBE_FINISHED", reason: "ALREADY_DETECTED", detectionId: "detection-0" })
    );
  });

  it("declares no permissions for its execution", () => {
    const { handler } = setup({});

    expect(handler.requiresPermission()).toEqual([]);
  });

  function setup(input: {
    enabled?: boolean;
    wallet?: ReturnType<typeof createUserWallet> | null;
    report?: ProbeReport;
    maxAttempts?: number;
    existingDetection?: boolean;
    enforcementMode?: "detect" | "enforce";
  }) {
    const wallet = input.wallet === undefined ? createUserWallet({ isTrialing: true }) : input.wallet;
    const userWalletRepository = mock<UserWalletRepository>();
    userWalletRepository.findById.mockResolvedValue(wallet ?? undefined);
    const probeService = mock<TrialWorkloadProbeService>();
    probeService.probe.mockResolvedValue(input.report ?? createReport({}));
    const probeJobService = mock<TrialWorkloadProbeJobService>();
    const detectionRepository = mock<WorkloadAbuseDetectionRepository>();
    detectionRepository.create.mockResolvedValue(mock<WorkloadAbuseDetectionOutput>({ id: "detection-1" }));
    detectionRepository.findOneBy.mockResolvedValue(input.existingDetection ? mock<WorkloadAbuseDetectionOutput>({ id: "detection-0" }) : undefined);
    const instrumentation = mock<WorkloadAbuseInstrumentationService>();
    const config = mockConfigService<WorkloadAbuseConfigService>({
      WORKLOAD_ABUSE_PROBE_ENABLED: input.enabled ?? true,
      WORKLOAD_ABUSE_PROBE_MAX_PER_DEPLOYMENT: input.maxAttempts ?? 30,
      WORKLOAD_ABUSE_ENFORCEMENT_MODE: input.enforcementMode ?? "detect"
    });
    const jobQueueService = mock<JobQueueService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const handler = new ProbeTrialDeploymentHandler(
      userWalletRepository,
      probeService,
      probeJobService,
      detectionRepository,
      instrumentation,
      config,
      jobQueueService,
      createLogger
    );

    return { handler, wallet: wallet!, userWalletRepository, probeService, probeJobService, detectionRepository, instrumentation, jobQueueService, logger };
  }
});
