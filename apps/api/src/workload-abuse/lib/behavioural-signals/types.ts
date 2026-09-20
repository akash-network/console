import type {
  ProbeEvidenceAccelerator,
  ProbeEvidenceArtifact,
  ProbeEvidenceBehaviouralFinding,
  ProbeEvidenceNetShape
} from "@src/workload-abuse/model-schemas";

export const BEHAVIOURAL_SIGNALS = {
  accelWithoutArtifacts: "accel_without_artifacts",
  networkIsolated: "network_isolated"
} as const;

export type BehaviouralSignal = (typeof BEHAVIOURAL_SIGNALS)[keyof typeof BEHAVIOURAL_SIGNALS];

export type BehaviouralFinding = ProbeEvidenceBehaviouralFinding;

/** The columns of one evidence row, so the replay and the live probe evaluate the exact same input. */
export type ProbeEvidenceSnapshot = {
  accelerator: ProbeEvidenceAccelerator[] | null;
  artifacts: ProbeEvidenceArtifact[] | null;
  netShape: ProbeEvidenceNetShape | null;
};

export type BehaviouralSignalParams = {
  accelMinVramMb: number;
  artifactMinMb: number;
  relayEndpoints: string[];
};
