import { describe, expect, it } from "vitest";

import type { ProbeEvidenceAccelerator, ProbeEvidenceArtifact } from "@src/workload-abuse/model-schemas";
import { evaluateAccelWithoutArtifacts } from "./accel-without-artifacts";
import type { BehaviouralSignalParams, ProbeEvidenceSnapshot } from "./types";

describe("evaluateAccelWithoutArtifacts", () => {
  it("fires when a process holds the accelerator and nothing large sits on disk", () => {
    const { snapshot, params } = setup({ vramMb: 18_000, artifacts: [{ path: "/opt/run", sizeBytes: 4_194_304 }] });

    expect(evaluateAccelWithoutArtifacts(snapshot, params)).toEqual({
      signal: "accel_without_artifacts",
      detail: { heaviestVramMb: 18_000, largestArtifactMb: 4 }
    });
  });

  it("reports the heaviest process when several share the accelerator", () => {
    const { snapshot, params } = setup({
      accelerator: [
        {
          name: "accelerator-0",
          utilPct: 99,
          memUsedMb: 20_000,
          memTotalMb: 24_576,
          processes: [
            { pid: 10, name: "worker", vramMb: 2_000 },
            { pid: 11, name: "worker", vramMb: 16_000 }
          ]
        }
      ],
      artifacts: []
    });

    expect(evaluateAccelWithoutArtifacts(snapshot, params)?.detail).toEqual({ heaviestVramMb: 16_000, largestArtifactMb: 0 });
  });

  it("stays silent when the workload carries large files", () => {
    const { snapshot, params } = setup({ vramMb: 18_000, artifacts: [{ path: "/models/weights", sizeBytes: 8_589_934_592 }] });

    expect(evaluateAccelWithoutArtifacts(snapshot, params)).toBeNull();
  });

  it("stays silent when no accelerator was reported", () => {
    const { snapshot, params } = setup({ accelerator: null, artifacts: [] });

    expect(evaluateAccelWithoutArtifacts(snapshot, params)).toBeNull();
  });

  it("stays silent when accelerator memory stays under the threshold", () => {
    const { snapshot, params } = setup({ vramMb: 200, artifacts: [], accelMinVramMb: 1_024 });

    expect(evaluateAccelWithoutArtifacts(snapshot, params)).toBeNull();
  });

  it("fires when the largest artifact sits just under the threshold", () => {
    const { snapshot, params } = setup({ vramMb: 18_000, artifacts: [{ path: "/opt/run", sizeBytes: 268_016_025 }], artifactMinMb: 256 });

    expect(evaluateAccelWithoutArtifacts(snapshot, params)?.detail).toEqual({ heaviestVramMb: 18_000, largestArtifactMb: 255 });
  });

  it("stays silent when the largest artifact reaches the threshold exactly", () => {
    const { snapshot, params } = setup({ vramMb: 18_000, artifacts: [{ path: "/opt/run", sizeBytes: 268_435_456 }], artifactMinMb: 256 });

    expect(evaluateAccelWithoutArtifacts(snapshot, params)).toBeNull();
  });

  it("stays silent when the probe collected no disk section", () => {
    const { snapshot, params } = setup({ vramMb: 18_000, artifacts: null });

    expect(evaluateAccelWithoutArtifacts(snapshot, params)).toBeNull();
  });

  function setup(input: {
    vramMb?: number;
    accelerator?: ProbeEvidenceAccelerator[] | null;
    artifacts?: ProbeEvidenceArtifact[] | null;
    accelMinVramMb?: number;
    artifactMinMb?: number;
  }) {
    const accelerator =
      input.accelerator !== undefined
        ? input.accelerator
        : [
            {
              name: "accelerator-0",
              utilPct: 98,
              memUsedMb: 20_480,
              memTotalMb: 24_576,
              processes: [{ pid: 1234, name: "worker", vramMb: input.vramMb ?? 18_000 }]
            }
          ];
    const snapshot: ProbeEvidenceSnapshot = { shellStatus: "completed", accelerator, artifacts: input.artifacts ?? null, netShape: null };
    const params: BehaviouralSignalParams = {
      accelMinVramMb: input.accelMinVramMb ?? 1_024,
      artifactMinMb: input.artifactMinMb ?? 256,
      relayEndpoints: []
    };

    return { snapshot, params };
  }
});
