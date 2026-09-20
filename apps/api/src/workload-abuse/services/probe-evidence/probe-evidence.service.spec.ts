import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { type CreateLogger } from "@src/core";
import type { WorkloadProbeEvidenceRepository } from "@src/workload-abuse/repositories/workload-probe-evidence/workload-probe-evidence.repository";
import type { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import type { WorkloadAbuseInstrumentationService } from "@src/workload-abuse/services/workload-abuse-instrumentation/workload-abuse-instrumentation.service";
import { ProbeEvidenceService } from "./probe-evidence.service";

import { mockConfigService } from "@test/mocks/config-service.mock";

describe(ProbeEvidenceService.name, () => {
  it("records one row per shell output with parsed features", async () => {
    const { service, evidenceRepository } = setup();
    evidenceRepository.insertMany.mockResolvedValue([]);

    await service.recordEvidence({
      walletId: 42,
      dseq: "1000001",
      verdict: "clean",
      probeStatus: "completed",
      shellOutputs: [
        {
          service: "web",
          provider: "akash1provider",
          output: "--accel\nNVIDIA T4, 90, 14000, 15360\n1234, python3, 14000\n--disk\n1073741824 /root/model.bin\n"
        },
        { service: "sidecar", provider: "akash1provider", output: "--loadavg\n0.10\n" }
      ]
    });

    expect(evidenceRepository.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({
        walletId: 42,
        dseq: "1000001",
        provider: "akash1provider",
        service: "web",
        probeStatus: "completed",
        verdict: "clean",
        accelerator: [expect.objectContaining({ name: "NVIDIA T4", utilPct: 90 })],
        artifacts: [{ path: "/root/model.bin", sizeBytes: 1073741824 }]
      }),
      expect.objectContaining({ service: "sidecar", accelerator: null, artifacts: null })
    ]);
  });

  it("skips the write when there are no shell outputs", async () => {
    const { service, evidenceRepository } = setup();

    await service.recordEvidence({ walletId: 42, dseq: "1000001", verdict: "clean", probeStatus: "completed", shellOutputs: [] });

    expect(evidenceRepository.insertMany).not.toHaveBeenCalled();
  });

  it("passes the detection id through to every row", async () => {
    const { service, evidenceRepository } = setup();
    evidenceRepository.insertMany.mockResolvedValue([]);

    await service.recordEvidence({
      walletId: 42,
      dseq: "1000001",
      verdict: "hard",
      probeStatus: "completed",
      detectionId: "detection-uuid",
      shellOutputs: [{ service: "web", provider: "akash1provider", output: "--accel\nNVIDIA T4, 1, 2, 3\n" }]
    });

    expect(evidenceRepository.insertMany).toHaveBeenCalledWith([expect.objectContaining({ detectionId: "detection-uuid" })]);
  });

  it("logs and counts a write failure without rethrowing", async () => {
    const { service, evidenceRepository, instrumentation, logger } = setup();
    evidenceRepository.insertMany.mockRejectedValue(new Error("connection refused"));

    await expect(
      service.recordEvidence({
        walletId: 42,
        dseq: "1000001",
        verdict: "clean",
        probeStatus: "completed",
        shellOutputs: [{ service: "web", provider: "akash1provider", output: "--disk\n1 /root/x\n" }]
      })
    ).resolves.toBeUndefined();

    expect(instrumentation.recordEvidenceWriteFailure).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "WORKLOAD_EVIDENCE_WRITE_FAILED", walletId: 42, dseq: "1000001" }));
  });

  it("purges rows older than the retention window", async () => {
    const { service, evidenceRepository } = setup();

    await service.purgeExpired();

    expect(evidenceRepository.deleteOlderThan).toHaveBeenCalledWith({ before: expect.any(Date) });
  });

  it("logs a purge failure without rethrowing", async () => {
    const { service, evidenceRepository, instrumentation, logger } = setup();
    evidenceRepository.deleteOlderThan.mockRejectedValue(new Error("deadlock"));

    await expect(service.purgeExpired()).resolves.toBeUndefined();

    expect(instrumentation.recordEvidenceWriteFailure).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "WORKLOAD_EVIDENCE_PURGE_FAILED" }));
  });

  function setup(input?: { retentionDays?: number }) {
    const evidenceRepository = mock<WorkloadProbeEvidenceRepository>();
    const instrumentation = mock<WorkloadAbuseInstrumentationService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const config = mockConfigService<WorkloadAbuseConfigService>({ WORKLOAD_ABUSE_EVIDENCE_RETENTION_DAYS: input?.retentionDays ?? 90 });
    const service = new ProbeEvidenceService(evidenceRepository, instrumentation, config, createLogger);

    return { service, evidenceRepository, instrumentation, logger, config };
  }
});
