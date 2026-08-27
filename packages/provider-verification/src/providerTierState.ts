import { VerificationTier } from "@akashnetwork/chain-sdk/private-types/akash.v1";

import { deriveProviderVerificationSummary, type ProviderVerificationFacts, type SnapshotComplianceState } from "./providerVerification.js";

export type ProviderTierDemotionChange = "tier_gate" | "snapshot_eligibility";

export interface ProviderTierState {
  effectiveTier: VerificationTier;
  maxPlacementTier: VerificationTier;
  snapshotState: SnapshotComplianceState;
}

export function deriveProviderTierState(facts: ProviderVerificationFacts): ProviderTierState {
  const summary = deriveProviderVerificationSummary(facts);
  const maxPlacementTier =
    summary.tierGateTier < VerificationTier.verification_tier_verified || summary.snapshotState === "current"
      ? summary.tierGateTier
      : VerificationTier.verification_tier_identified;

  return {
    effectiveTier: summary.tierGateTier,
    maxPlacementTier,
    snapshotState: summary.snapshotState
  };
}

export function detectProviderTierDemotion(previous: ProviderTierState, current: ProviderTierState): ProviderTierDemotionChange[] {
  const changes: ProviderTierDemotionChange[] = [];
  if (current.effectiveTier < previous.effectiveTier) changes.push("tier_gate");
  if (current.maxPlacementTier < previous.maxPlacementTier) changes.push("snapshot_eligibility");
  return changes;
}
