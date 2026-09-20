import { evaluateAccelWithoutArtifacts } from "./accel-without-artifacts";
import { evaluateNetworkIsolation } from "./network-isolation";
import { BEHAVIOURAL_SIGNALS, type BehaviouralFinding, type BehaviouralSignalParams, type ProbeEvidenceSnapshot } from "./types";

export function evaluateBehaviouralSignals(snapshot: ProbeEvidenceSnapshot, params: BehaviouralSignalParams): BehaviouralFinding[] {
  const evaluated = [evaluateAccelWithoutArtifacts(snapshot, params), evaluateNetworkIsolation(snapshot, params)];

  return evaluated.filter((finding): finding is BehaviouralFinding => finding !== null);
}

/** Either signal alone has a known benign population, so only the conjunction describes the shape worth acting on. */
export function isBehaviouralCandidate(findings: BehaviouralFinding[]): boolean {
  const signals = new Set(findings.map(finding => finding.signal));

  return signals.has(BEHAVIOURAL_SIGNALS.accelWithoutArtifacts) && signals.has(BEHAVIOURAL_SIGNALS.networkIsolated);
}
