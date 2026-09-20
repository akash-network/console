import { describe, expect, it } from "vitest";

import { evaluateBehaviouralSignals, isBehaviouralCandidate } from "./evaluate-behavioural-signals";
import type { BehaviouralSignalParams, ProbeEvidenceSnapshot } from "./types";

describe("evaluateBehaviouralSignals", () => {
  it("returns both findings when the snapshot matches both signals", () => {
    const { snapshot, params } = setup({ vramMb: 18_000, artifactBytes: 1_024, established: [] });

    expect(evaluateBehaviouralSignals(snapshot, params).map(finding => finding.signal)).toEqual(["accel_without_artifacts", "network_isolated"]);
  });

  it("returns one finding when the workload carries weights but talks to nobody", () => {
    const { snapshot, params } = setup({ vramMb: 18_000, artifactBytes: 8_589_934_592, established: [] });

    expect(evaluateBehaviouralSignals(snapshot, params).map(finding => finding.signal)).toEqual(["network_isolated"]);
  });

  it("returns nothing when the snapshot matches neither signal", () => {
    const { snapshot, params } = setup({
      vramMb: 18_000,
      artifactBytes: 8_589_934_592,
      established: [{ localPort: 8_080, remoteIp: "203.0.113.9", remotePort: 51_000, count: 2 }]
    });

    expect(evaluateBehaviouralSignals(snapshot, params)).toEqual([]);
  });

  it("returns nothing when the shell that collected the snapshot was cut short", () => {
    const { snapshot, params } = setup({ vramMb: 18_000, artifactBytes: 1_024, established: [], shellStatus: "output_capped" });

    expect(evaluateBehaviouralSignals(snapshot, params)).toEqual([]);
  });

  it("treats the two signals together as a candidate", () => {
    const { snapshot, params } = setup({ vramMb: 18_000, artifactBytes: 1_024, established: [] });

    expect(isBehaviouralCandidate(evaluateBehaviouralSignals(snapshot, params))).toBe(true);
  });

  it("treats a single signal as no candidate", () => {
    const { snapshot, params } = setup({ vramMb: 18_000, artifactBytes: 8_589_934_592, established: [] });

    expect(isBehaviouralCandidate(evaluateBehaviouralSignals(snapshot, params))).toBe(false);
  });

  function setup(input: {
    vramMb: number;
    artifactBytes: number;
    established: NonNullable<ProbeEvidenceSnapshot["netShape"]>["established"];
    shellStatus?: string;
  }) {
    const snapshot: ProbeEvidenceSnapshot = {
      shellStatus: input.shellStatus ?? "completed",
      accelerator: [
        { name: "accelerator-0", utilPct: 97, memUsedMb: 20_480, memTotalMb: 24_576, processes: [{ pid: 1234, name: "worker", vramMb: input.vramMb }] }
      ],
      artifacts: [{ path: "/opt/payload", sizeBytes: input.artifactBytes }],
      netShape: { listenPorts: [8_080], established: input.established }
    };
    const params: BehaviouralSignalParams = { accelMinVramMb: 1_024, artifactMinMb: 256, relayEndpoints: [] };

    return { snapshot, params };
  }
});
