import type { AttestationStatus, CapabilityFlag, VerificationGraceStatus, VerificationTier } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import type { ProviderVerificationCompleteness } from "@akashnetwork/provider-verification";

export interface StoredVerificationAttestation {
  auditor: string;
  capabilities: CapabilityFlag[];
  status: AttestationStatus;
  tier: VerificationTier;
}

export interface StoredVerificationGrace {
  preservedTier: VerificationTier;
  status: VerificationGraceStatus;
}

export interface StoredVerificationSnapshot {
  complianceDeadline: string | null;
  suspended: boolean;
}

export interface StoredProviderVerificationFacts {
  attestations: StoredVerificationAttestation[];
  completeness: ProviderVerificationCompleteness;
  graces: StoredVerificationGrace[];
  observedAt: string;
  observedHeight: string;
  snapshot: StoredVerificationSnapshot | null;
}

export interface StoredProviderVerification {
  facts: StoredProviderVerificationFacts;
  moduleActive: boolean | null;
}
