import type {
  AttestationRecord,
  ProviderSnapshotRecord,
  ProviderVerificationGraceRecord,
  VerificationRequirement
} from "@akashnetwork/chain-sdk/private-types/akash.v1";
import {
  AttestationStatus,
  AuditorSelectionMode,
  CapabilityFlag,
  VerificationGraceStatus,
  VerificationTier
} from "@akashnetwork/chain-sdk/private-types/akash.v1";

type AttestationFact = Pick<AttestationRecord, "auditor" | "capabilities" | "status" | "tier">;
type GraceFact = Pick<ProviderVerificationGraceRecord, "preservedTier" | "status">;
type SnapshotFact = Pick<ProviderSnapshotRecord, "complianceDeadline" | "suspended">;

export interface ProviderVerificationCompleteness {
  attestations: boolean;
  graces: boolean;
  snapshot: boolean;
}

export interface ProviderVerificationFacts {
  attestations: readonly AttestationFact[];
  graces: readonly GraceFact[];
  snapshot: SnapshotFact | null;
  completeness: ProviderVerificationCompleteness;
  observedAt: Date;
  observedHeight: string;
}

export type SnapshotComplianceState = "unknown" | "not_posted" | "current" | "stale" | "suspended";

export interface ProviderVerificationSummary {
  bestStatusValidTier: VerificationTier;
  tierGateTier: VerificationTier;
  capabilities: CapabilityFlag[];
  validAttestationCount: number;
  validAuditors: string[];
  snapshotState: SnapshotComplianceState;
  observedHeight: string;
}

export type ProviderVerificationFailure =
  | { code: "snapshot_not_posted" }
  | { code: "snapshot_suspended" }
  | { code: "snapshot_stale" }
  | { code: "insufficient_tier"; actual: VerificationTier; required: VerificationTier }
  | { code: "missing_capability"; capability: CapabilityFlag }
  | { code: "insufficient_auditor_count"; actual: number; required: number }
  | { code: "required_auditor_not_found"; mode: AuditorSelectionMode; missing: string[] };

interface EvaluationBase {
  summary: ProviderVerificationSummary;
  qualifiedAuditors: string[];
}

export type ProviderVerificationEvaluation =
  | (EvaluationBase & { outcome: "pass"; firstFailure: null; failures: [] })
  | (EvaluationBase & {
      outcome: "fail";
      firstFailure: ProviderVerificationFailure;
      failures: ProviderVerificationFailure[];
    })
  | (EvaluationBase & { outcome: "unknown"; firstFailure: null; failures: []; incompleteFacts: Array<keyof ProviderVerificationCompleteness | "params"> });

interface EvaluateProviderVerificationInput {
  moduleActive: boolean | null;
  requirement: VerificationRequirement | null;
  facts: ProviderVerificationFacts;
}

export function deriveProviderVerificationSummary(facts: ProviderVerificationFacts): ProviderVerificationSummary {
  const validAttestations = facts.attestations.filter(attestation => attestation.status === AttestationStatus.attestation_status_valid);
  const bestStatusValidTier = validAttestations.reduce(
    (best, attestation) => betterTier(best, attestation.tier),
    VerificationTier.verification_tier_unspecified
  );
  const tierGateTier = facts.graces
    .filter(grace => grace.status === VerificationGraceStatus.verification_grace_status_active)
    .reduce((best, grace) => betterTier(best, grace.preservedTier), bestStatusValidTier);
  const capabilities = uniqueSorted(
    validAttestations.flatMap(attestation => attestation.capabilities).filter(capability => capability !== CapabilityFlag.capability_unspecified)
  );
  const validAuditors = uniqueSorted(validAttestations.map(attestation => attestation.auditor).filter(Boolean));

  return {
    bestStatusValidTier,
    tierGateTier,
    capabilities,
    validAttestationCount: validAttestations.length,
    validAuditors,
    snapshotState: deriveSnapshotState(facts),
    observedHeight: facts.observedHeight
  };
}

export function evaluateProviderVerification({ moduleActive, requirement, facts }: EvaluateProviderVerificationInput): ProviderVerificationEvaluation {
  const summary = deriveProviderVerificationSummary(facts);
  const noRequirement = !requirement || requirement.minTier === VerificationTier.verification_tier_unspecified;

  if (noRequirement || moduleActive === false) {
    return pass(summary, []);
  }

  const incompleteFacts: Array<keyof ProviderVerificationCompleteness | "params"> = [];
  if (moduleActive === null) incompleteFacts.push("params");
  if (!facts.completeness.attestations) incompleteFacts.push("attestations");
  if (!facts.completeness.graces) incompleteFacts.push("graces");
  if (requiresSnapshot(requirement.minTier) && !facts.completeness.snapshot) incompleteFacts.push("snapshot");

  const qualifiedAuditors = qualifiedAuditorsForTier(facts.attestations, requirement.minTier);
  if (incompleteFacts.length > 0) {
    return { outcome: "unknown", firstFailure: null, failures: [], incompleteFacts, qualifiedAuditors, summary };
  }

  const failures: ProviderVerificationFailure[] = [];
  if (requiresSnapshot(requirement.minTier)) {
    if (summary.snapshotState === "not_posted") failures.push({ code: "snapshot_not_posted" });
    if (summary.snapshotState === "suspended") failures.push({ code: "snapshot_suspended" });
    if (summary.snapshotState === "stale") failures.push({ code: "snapshot_stale" });
  }

  if (summary.tierGateTier < requirement.minTier) {
    failures.push({ code: "insufficient_tier", actual: summary.tierGateTier, required: requirement.minTier });
  }

  for (const capability of requirement.requiredCapabilities) {
    if (capability !== CapabilityFlag.capability_unspecified && !summary.capabilities.includes(capability)) {
      failures.push({ code: "missing_capability", capability });
    }
  }

  if (qualifiedAuditors.length < requirement.minAuditorCount) {
    failures.push({ code: "insufficient_auditor_count", actual: qualifiedAuditors.length, required: requirement.minAuditorCount });
  }

  const requiredAuditorFailure = evaluateRequiredAuditors(requirement, qualifiedAuditors);
  if (requiredAuditorFailure) failures.push(requiredAuditorFailure);

  return failures.length === 0 ? pass(summary, qualifiedAuditors) : { outcome: "fail", firstFailure: failures[0], failures, qualifiedAuditors, summary };
}

function deriveSnapshotState(facts: ProviderVerificationFacts): SnapshotComplianceState {
  if (!facts.completeness.snapshot) return "unknown";
  if (!facts.snapshot) return "not_posted";
  if (facts.snapshot.suspended) return "suspended";
  if (!facts.snapshot.complianceDeadline || facts.snapshot.complianceDeadline <= facts.observedAt) return "stale";
  return "current";
}

function requiresSnapshot(tier: VerificationTier): boolean {
  return tier >= VerificationTier.verification_tier_verified;
}

function betterTier(left: VerificationTier, right: VerificationTier): VerificationTier {
  return right > left ? right : left;
}

function qualifiedAuditorsForTier(attestations: readonly AttestationFact[], minTier: VerificationTier): string[] {
  return uniqueSorted(
    attestations
      .filter(attestation => attestation.status === AttestationStatus.attestation_status_valid && attestation.tier >= minTier)
      .map(attestation => attestation.auditor)
      .filter(Boolean)
  );
}

function evaluateRequiredAuditors(
  requirement: VerificationRequirement,
  qualifiedAuditors: readonly string[]
): Extract<ProviderVerificationFailure, { code: "required_auditor_not_found" }> | null {
  if (requirement.requiredAuditors.length === 0) return null;

  const available = new Set(qualifiedAuditors);
  const missing = requirement.requiredAuditors.filter(auditor => !available.has(auditor));
  const allRequired = requirement.auditorMode === AuditorSelectionMode.auditor_selection_mode_all;
  const satisfied = allRequired ? missing.length === 0 : requirement.requiredAuditors.some(auditor => available.has(auditor));

  return satisfied ? null : { code: "required_auditor_not_found", mode: requirement.auditorMode, missing };
}

function uniqueSorted<T extends number | string>(values: readonly T[]): T[] {
  return [...new Set(values)].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

function pass(summary: ProviderVerificationSummary, qualifiedAuditors: string[]): ProviderVerificationEvaluation {
  return { outcome: "pass", firstFailure: null, failures: [], qualifiedAuditors, summary };
}
