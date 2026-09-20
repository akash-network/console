import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import type {
  WorkloadProbeEvidenceOutput,
  WorkloadProbeEvidenceRepository
} from "@src/workload-abuse/repositories/workload-probe-evidence/workload-probe-evidence.repository";
import type { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import { BehaviouralSignalReplayService } from "./behavioural-signal-replay.service";

import { mockConfigService } from "@test/mocks/config-service.mock";

describe(BehaviouralSignalReplayService.name, () => {
  it("flags the accelerator-bound shape that carries nothing on disk and talks to nobody", async () => {
    const { service } = setup();

    const summary = await service.replay({ bundledFixtures: true });

    expect(summary.deployments).toContainEqual({
      source: "fixture",
      label: "accelerator-bound-no-artifacts",
      probes: 3,
      accelFires: 3,
      networkFires: 3,
      candidateProbes: 3,
      longestAgreement: 3
    });
  });

  it("leaves a workload that serves traffic from large local files alone", async () => {
    const { service } = setup();

    const summary = await service.replay({ bundledFixtures: true });
    const inference = summary.deployments.find(deployment => deployment.label === "inference-with-weights");

    expect(inference).toMatchObject({ accelFires: 0, networkFires: 0, candidateProbes: 0 });
  });

  it("records a single signal for a quiet host whose only connection is a first-party relay", async () => {
    const { service } = setup({ relayEndpoints: ["10.0.0.7"] });

    const summary = await service.replay({ bundledFixtures: true });
    const bastion = summary.deployments.find(deployment => deployment.label === "idle-shell-host");

    expect(bastion).toMatchObject({ accelFires: 0, networkFires: 2, candidateProbes: 0 });
  });

  it("stops short of a candidate when a packaged runtime fills the disk", async () => {
    const { service } = setup();

    const summary = await service.replay({ bundledFixtures: true });
    const packaged = summary.deployments.find(deployment => deployment.label === "packaged-runtime");

    expect(packaged).toMatchObject({ accelFires: 0, networkFires: 2, candidateProbes: 0 });
  });

  it("counts how many deployments each agreement length would reach", async () => {
    const { service } = setup();

    const summary = await service.replay({ bundledFixtures: true });

    expect(summary.wouldEnforce).toEqual([
      { agreementProbes: 1, deployments: 1 },
      { agreementProbes: 2, deployments: 1 },
      { agreementProbes: 3, deployments: 1 },
      { agreementProbes: 5, deployments: 0 }
    ]);
  });

  it("reports how the outcome moves when the thresholds move", async () => {
    const { service } = setup();

    const summary = await service.replay({ bundledFixtures: true });

    expect(summary.sensitivity).toContainEqual({ accelMinVramMb: 1_024, artifactMinMb: 256, candidateDeployments: 1 });
    expect(summary.sensitivity).toContainEqual({ accelMinVramMb: 1_024, artifactMinMb: 512, candidateDeployments: 1 });
    expect(summary.sensitivity).toContainEqual({ accelMinVramMb: 2_048, artifactMinMb: 128, candidateDeployments: 1 });
  });

  it("groups recorded evidence by deployment and service", async () => {
    const { service, evidenceRepository } = setup({
      rows: [
        createRow({ id: "row-1", service: "web" }),
        createRow({ id: "row-2", service: "web" }),
        createRow({ id: "row-3", service: "sidecar", accelerator: null })
      ]
    });

    const summary = await service.replay({ since: new Date("2026-08-01T00:00:00.000Z"), until: new Date("2026-09-01T00:00:00.000Z") });

    expect(evidenceRepository.findCreatedBetween).toHaveBeenCalledWith({
      since: new Date("2026-08-01T00:00:00.000Z"),
      until: new Date("2026-09-01T00:00:00.000Z")
    });
    expect(summary.deployments).toEqual([
      { source: "database", label: "42/1000001/web", probes: 2, accelFires: 2, networkFires: 2, candidateProbes: 2, longestAgreement: 2 },
      { source: "database", label: "42/1000001/sidecar", probes: 1, accelFires: 0, networkFires: 1, candidateProbes: 0, longestAgreement: 0 }
    ]);
  });

  it("reads the window from the request and writes nothing back", async () => {
    const { service, evidenceRepository } = setup();

    const summary = await service.replay({ since: new Date("2026-08-01T00:00:00.000Z"), until: new Date("2026-09-01T00:00:00.000Z") });

    expect(summary.window).toEqual({ since: "2026-08-01T00:00:00.000Z", until: "2026-09-01T00:00:00.000Z" });
    expect(evidenceRepository.recordBehaviouralFindings).not.toHaveBeenCalled();
    expect(evidenceRepository.insertMany).not.toHaveBeenCalled();
    expect(evidenceRepository.deleteOlderThan).not.toHaveBeenCalled();
  });

  it("applies the thresholds the operator asked for instead of the configured ones", async () => {
    const { service } = setup({ rows: [createRow({ id: "row-1", service: "web" })] });

    const summary = await service.replay({ since: new Date("2026-08-01T00:00:00.000Z"), accelMinVramMb: 20_000 });

    expect(summary.params).toMatchObject({ accelMinVramMb: 20_000, artifactMinMb: 256 });
    expect(summary.deployments[0]).toMatchObject({ accelFires: 0 });
  });

  function createRow(overrides: Partial<WorkloadProbeEvidenceOutput>) {
    return mock<WorkloadProbeEvidenceOutput>({
      walletId: 42,
      dseq: "1000001",
      accelerator: [{ name: "accelerator-0", utilPct: 99, memUsedMb: 20_480, memTotalMb: 24_576, processes: [{ pid: 1234, name: "worker", vramMb: 18_000 }] }],
      artifacts: [{ path: "/opt/worker", sizeBytes: 4_194_304 }],
      netShape: { listenPorts: [22], established: [] },
      ...overrides
    });
  }

  function setup(input?: { rows?: WorkloadProbeEvidenceOutput[]; relayEndpoints?: string[] }) {
    const evidenceRepository = mock<WorkloadProbeEvidenceRepository>();
    evidenceRepository.findCreatedBetween.mockResolvedValue(input?.rows ?? []);
    const config = mockConfigService<WorkloadAbuseConfigService>({
      WORKLOAD_ABUSE_SIGNAL_ACCEL_MIN_VRAM_MB: 1_024,
      WORKLOAD_ABUSE_SIGNAL_ARTIFACT_MIN_MB: 256,
      WORKLOAD_ABUSE_SIGNAL_RELAY_ENDPOINTS: input?.relayEndpoints ?? []
    });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const service = new BehaviouralSignalReplayService(evidenceRepository, config, createLogger);

    return { service, evidenceRepository, logger };
  }
});
