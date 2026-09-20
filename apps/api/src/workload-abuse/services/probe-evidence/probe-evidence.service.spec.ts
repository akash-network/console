import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { type CreateLogger } from "@src/core";
import type {
  WorkloadProbeEvidenceOutput,
  WorkloadProbeEvidenceRepository
} from "@src/workload-abuse/repositories/workload-probe-evidence/workload-probe-evidence.repository";
import type { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import type { WorkloadAbuseInstrumentationService } from "@src/workload-abuse/services/workload-abuse-instrumentation/workload-abuse-instrumentation.service";
import { ProbeEvidenceService } from "./probe-evidence.service";

import { mockConfigService } from "@test/mocks/config-service.mock";

describe(ProbeEvidenceService.name, () => {
  it("records one row per probed service with parsed features", async () => {
    const { service, evidenceRepository } = setup();
    evidenceRepository.insertMany.mockResolvedValue([]);

    await service.recordEvidence({
      walletId: 42,
      dseq: "1000001",
      verdict: "clean",
      shellEvidence: [
        {
          service: "web",
          provider: "akash1provider",
          status: "completed",
          evidence: "--accel\nGPU-0001, NVIDIA T4, 90, 14000, 15360\nGPU-0001, 1234, python3, 14000\n--disk\n1073741824 /root/model.bin\n"
        },
        { service: "sidecar", provider: "akash1provider", status: "output_capped", evidence: "" }
      ]
    });

    expect(evidenceRepository.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({
        walletId: 42,
        dseq: "1000001",
        provider: "akash1provider",
        service: "web",
        shellStatus: "completed",
        verdict: "clean",
        accelerator: [expect.objectContaining({ name: "NVIDIA T4", utilPct: 90 })],
        artifacts: [{ path: "/root/model.bin", sizeBytes: 1073741824 }]
      }),
      expect.objectContaining({ service: "sidecar", shellStatus: "output_capped", accelerator: null, artifacts: null })
    ]);
  });

  it("skips the write when no service was reached", async () => {
    const { service, evidenceRepository } = setup();

    await service.recordEvidence({ walletId: 42, dseq: "1000001", verdict: "clean", shellEvidence: [] });

    expect(evidenceRepository.insertMany).not.toHaveBeenCalled();
  });

  it("passes the detection id through to every row", async () => {
    const { service, evidenceRepository } = setup();
    evidenceRepository.insertMany.mockResolvedValue([]);

    await service.recordEvidence({
      walletId: 42,
      dseq: "1000001",
      verdict: "hard",
      detectionId: "detection-uuid",
      shellEvidence: [{ service: "web", provider: "akash1provider", status: "completed", evidence: "--accel\nGPU-0001, NVIDIA T4, 1, 2, 3\n" }]
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
        shellEvidence: [{ service: "web", provider: "akash1provider", status: "completed", evidence: "--disk\n1 /root/x\n" }]
      })
    ).resolves.toEqual([]);

    expect(instrumentation.recordEvidenceWriteFailure).toHaveBeenCalledWith("insert");
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "WORKLOAD_EVIDENCE_WRITE_FAILED", walletId: 42, dseq: "1000001" }));
  });

  it("records the signals that fire on a stored row", async () => {
    const { service, evidenceRepository, instrumentation } = setup({ signalsEnabled: true });

    const recorded = await service.recordBehaviouralFindings([createEvidenceRow()]);

    expect(evidenceRepository.recordBehaviouralFindings).toHaveBeenCalledWith({
      id: "evidence-1",
      findings: [
        { signal: "accel_without_artifacts", detail: { heaviestVramMb: 18_000, largestArtifactMb: 4 } },
        { signal: "network_isolated", detail: { excludedRelay: 0, listenPorts: 1 } }
      ]
    });
    expect(recorded).toEqual([{ evidenceId: "evidence-1", service: "web", findings: expect.any(Array) }]);
    expect(instrumentation.recordBehaviouralFinding).toHaveBeenCalledTimes(2);
  });

  it("evaluates nothing while behavioural signals are disabled", async () => {
    const { service, evidenceRepository } = setup({ signalsEnabled: false });

    await expect(service.recordBehaviouralFindings([createEvidenceRow()])).resolves.toEqual([]);

    expect(evidenceRepository.recordBehaviouralFindings).not.toHaveBeenCalled();
  });

  it("leaves a row alone when no signal fires", async () => {
    const { service, evidenceRepository } = setup({ signalsEnabled: true });

    const recorded = await service.recordBehaviouralFindings([
      createEvidenceRow({
        accelerator: null,
        netShape: { listenPorts: [8_080], connections: [{ localPort: 8_080, remoteIp: "203.0.113.5", remotePort: 51_000, count: 1, state: "established" }] }
      })
    ]);

    expect(recorded).toEqual([]);
    expect(evidenceRepository.recordBehaviouralFindings).not.toHaveBeenCalled();
  });

  it("records nothing for a row whose shell was cut short", async () => {
    const { service, evidenceRepository } = setup({ signalsEnabled: true });

    await expect(service.recordBehaviouralFindings([createEvidenceRow({ shellStatus: "output_capped" })])).resolves.toEqual([]);

    expect(evidenceRepository.recordBehaviouralFindings).not.toHaveBeenCalled();
  });

  it("logs and counts a findings write failure without rethrowing", async () => {
    const { service, evidenceRepository, instrumentation, logger } = setup({ signalsEnabled: true });
    evidenceRepository.recordBehaviouralFindings.mockRejectedValue(new Error("connection refused"));

    await expect(service.recordBehaviouralFindings([createEvidenceRow()])).resolves.toEqual([]);

    expect(instrumentation.recordEvidenceWriteFailure).toHaveBeenCalledWith("findings");
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "WORKLOAD_EVIDENCE_FINDINGS_WRITE_FAILED", walletId: 42, dseq: "1000001" }));
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

    expect(instrumentation.recordEvidenceWriteFailure).toHaveBeenCalledWith("purge");
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "WORKLOAD_EVIDENCE_PURGE_FAILED" }));
  });

  function createEvidenceRow(overrides: Partial<WorkloadProbeEvidenceOutput> = {}) {
    return mock<WorkloadProbeEvidenceOutput>({
      id: "evidence-1",
      walletId: 42,
      dseq: "1000001",
      service: "web",
      shellStatus: "completed",
      accelerator: [{ name: "accelerator-0", utilPct: 99, memUsedMb: 20_480, memTotalMb: 24_576, processes: [{ pid: 1234, name: "worker", vramMb: 18_000 }] }],
      artifacts: [{ path: "/opt/worker", sizeBytes: 4_194_304 }],
      netShape: { listenPorts: [22], connections: [] },
      ...overrides
    });
  }

  function setup(input?: { retentionDays?: number; signalsEnabled?: boolean }) {
    const evidenceRepository = mock<WorkloadProbeEvidenceRepository>();
    const instrumentation = mock<WorkloadAbuseInstrumentationService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const config = mockConfigService<WorkloadAbuseConfigService>({
      WORKLOAD_ABUSE_EVIDENCE_RETENTION_DAYS: input?.retentionDays ?? 90,
      WORKLOAD_ABUSE_BEHAVIOURAL_SIGNALS_ENABLED: input?.signalsEnabled ?? false,
      WORKLOAD_ABUSE_SIGNAL_ACCEL_MIN_VRAM_MB: 1_024,
      WORKLOAD_ABUSE_SIGNAL_ARTIFACT_MIN_MB: 256,
      WORKLOAD_ABUSE_SIGNAL_RELAY_ENDPOINTS: []
    });
    const service = new ProbeEvidenceService(evidenceRepository, instrumentation, config, createLogger);

    return { service, evidenceRepository, instrumentation, logger, config };
  }
});
