import type { DeploymentGroup, RpcVerificationCapability, RpcVerificationTier } from "@src/types/deployment";
import type { ProviderVerificationCapability, ProviderVerificationTier } from "@src/types/provider";

export interface PlacementVerificationPolicy {
  minTier: ProviderVerificationTier;
  requiredCapabilities: ProviderVerificationCapability[];
  requiredAuditors: string[];
  auditorMode: "any" | "all" | "unknown";
  minAuditorCount: number;
}

export interface PlacementSecurityPolicy {
  legacySignedBy: {
    allOf: string[];
    anyOf: string[];
  } | null;
  verification: PlacementVerificationPolicy | null;
}

const TIERS: Record<RpcVerificationTier, ProviderVerificationTier> = {
  verification_tier_unspecified: "L0",
  verification_tier_identified: "L1",
  verification_tier_verified: "L2",
  verification_tier_established: "L3",
  verification_tier_trusted: "L4"
};

const CAPABILITIES: Record<RpcVerificationCapability, ProviderVerificationCapability> = {
  capability_unspecified: "unspecified",
  capability_tee_hardware_attestation: "tee_hardware_attestation",
  capability_confidential_computing: "confidential_computing",
  capability_persistent_storage: "persistent_storage",
  capability_bare_metal: "bare_metal"
};

export function getPlacementSecurityPolicy(group: DeploymentGroup | undefined): PlacementSecurityPolicy {
  const requirements = group?.group_spec?.requirements;
  const signedBy = requirements?.signed_by;
  const allOf = signedBy?.all_of ?? [];
  const anyOf = signedBy?.any_of ?? [];
  const verification = requirements?.verification;

  return {
    legacySignedBy: allOf.length > 0 || anyOf.length > 0 ? { allOf, anyOf } : null,
    verification: verification
      ? {
          minTier: TIERS[verification.min_tier] ?? "unknown",
          requiredCapabilities: verification.required_capabilities.map(capability => CAPABILITIES[capability] ?? "unknown"),
          requiredAuditors: verification.required_auditors,
          auditorMode:
            verification.auditor_mode === "auditor_selection_mode_all" ? "all" : verification.auditor_mode === "auditor_selection_mode_any" ? "any" : "unknown",
          minAuditorCount: verification.min_auditor_count
        }
      : null
  };
}

export function isTierBelow(current: ProviderVerificationTier | null, required: ProviderVerificationTier): boolean {
  const rank = { L0: 0, L1: 1, L2: 2, L3: 3, L4: 4 } as const;
  if (current === null || current === "unknown" || required === "unknown") return false;
  return rank[current] < rank[required];
}
