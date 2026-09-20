import { BEHAVIOURAL_SIGNALS, type BehaviouralFinding, type BehaviouralSignalParams, type ProbeEvidenceSnapshot } from "./types";

const BYTES_PER_MB = 1024 * 1024;

/** A snapshot without a disk section reports nothing rather than an empty disk, so it cannot support this signal. */
export function evaluateAccelWithoutArtifacts(snapshot: ProbeEvidenceSnapshot, params: BehaviouralSignalParams): BehaviouralFinding | null {
  const heaviestVramMb = findHeaviestVramMb(snapshot);

  if (heaviestVramMb < params.accelMinVramMb) return null;
  if (!snapshot.artifacts) return null;

  const largestArtifactMb = findLargestArtifactMb(snapshot);

  if (largestArtifactMb >= params.artifactMinMb) return null;

  return { signal: BEHAVIOURAL_SIGNALS.accelWithoutArtifacts, detail: { heaviestVramMb, largestArtifactMb } };
}

function findHeaviestVramMb(snapshot: ProbeEvidenceSnapshot): number {
  const vramPerProcess = (snapshot.accelerator ?? []).flatMap(accelerator => accelerator.processes.map(process => process.vramMb));
  return vramPerProcess.reduce((heaviest, vramMb) => Math.max(heaviest, vramMb), 0);
}

function findLargestArtifactMb(snapshot: ProbeEvidenceSnapshot): number {
  const sizes = (snapshot.artifacts ?? []).map(artifact => Math.round(artifact.sizeBytes / BYTES_PER_MB));
  return sizes.reduce((largest, sizeMb) => Math.max(largest, sizeMb), 0);
}
