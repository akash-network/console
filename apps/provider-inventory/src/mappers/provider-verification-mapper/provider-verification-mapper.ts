import type { ProviderVerificationScreeningState } from "@akashnetwork/provider-verification";
import type { ProviderVerificationFacts } from "@akashnetwork/provider-verification";

import type { StoredProviderVerification } from "@src/types/provider-verification";

interface MapProviderVerificationInput {
  moduleActive: boolean | null;
  observedAt: Date;
  observedHeight: string;
  state: ProviderVerificationScreeningState | null;
}

export function mapProviderVerification(input: MapProviderVerificationInput): StoredProviderVerification {
  const { moduleActive, observedAt, observedHeight, state } = input;

  if (!state) {
    return {
      moduleActive,
      facts: {
        attestations: [],
        completeness: { attestations: false, graces: false, snapshot: false },
        graces: [],
        observedAt: observedAt.toISOString(),
        observedHeight,
        snapshot: null
      }
    };
  }

  return {
    moduleActive,
    facts: {
      attestations: state.attestations
        .map(attestation => ({
          auditor: attestation.auditor,
          capabilities: [...attestation.capabilities].sort((left, right) => left - right),
          status: attestation.status,
          tier: attestation.tier
        }))
        .sort((left, right) => left.auditor.localeCompare(right.auditor)),
      completeness: { attestations: true, graces: true, snapshot: true },
      graces: state.grace ? [{ preservedTier: state.grace.preservedTier, status: state.grace.status }] : [],
      observedAt: observedAt.toISOString(),
      observedHeight,
      snapshot: state.snapshot
        ? {
            complianceDeadline: state.snapshot.complianceDeadline?.toISOString() ?? null,
            suspended: state.snapshot.suspended
          }
        : null
    }
  };
}

export function mapStoredProviderVerificationFacts(verification: StoredProviderVerification): ProviderVerificationFacts {
  return {
    attestations: verification.facts.attestations,
    completeness: verification.facts.completeness,
    graces: verification.facts.graces,
    observedAt: new Date(verification.facts.observedAt),
    observedHeight: verification.facts.observedHeight,
    snapshot: verification.facts.snapshot
      ? {
          complianceDeadline: verification.facts.snapshot.complianceDeadline ? new Date(verification.facts.snapshot.complianceDeadline) : undefined,
          suspended: verification.facts.snapshot.suspended
        }
      : null
  };
}
