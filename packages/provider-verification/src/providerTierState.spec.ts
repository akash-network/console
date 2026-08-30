import type { AttestationRecord, ProviderSnapshotRecord, ProviderVerificationGraceRecord } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { AttestationStatus, VerificationGraceStatus, VerificationTier } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { describe, expect, it } from "vitest";

import { deriveProviderTierState, detectProviderTierDemotion } from "./providerTierState.js";
import type { ProviderVerificationFacts } from "./providerVerification.js";

const observedAt = new Date("2026-08-24T12:00:00.000Z");

describe(deriveProviderTierState.name, () => {
  it("uses active grace for the effective tier", () => {
    expect(
      deriveProviderTierState(
        facts({
          attestations: [attestation(VerificationTier.verification_tier_identified)],
          graces: [grace(VerificationTier.verification_tier_established)],
          snapshot: snapshot({ complianceDeadline: new Date("2026-08-25T12:00:00.000Z") })
        })
      )
    ).toEqual({
      effectiveTier: VerificationTier.verification_tier_established,
      maxPlacementTier: VerificationTier.verification_tier_established,
      snapshotState: "current"
    });
  });

  it.each(["not_posted", "stale", "suspended"] as const)("clamps L2+ placement eligibility to L1 when the snapshot is %s", snapshotState => {
    const snapshotByState = {
      not_posted: null,
      stale: snapshot({ complianceDeadline: observedAt }),
      suspended: snapshot({ complianceDeadline: new Date("2026-08-25T12:00:00.000Z"), suspended: true })
    };

    expect(
      deriveProviderTierState(facts({ attestations: [attestation(VerificationTier.verification_tier_trusted)], snapshot: snapshotByState[snapshotState] }))
    ).toMatchObject({
      effectiveTier: VerificationTier.verification_tier_trusted,
      maxPlacementTier: VerificationTier.verification_tier_identified,
      snapshotState
    });
  });

  it("does not require a snapshot for L1", () => {
    expect(deriveProviderTierState(facts({ attestations: [attestation(VerificationTier.verification_tier_identified)] }))).toMatchObject({
      effectiveTier: VerificationTier.verification_tier_identified,
      maxPlacementTier: VerificationTier.verification_tier_identified,
      snapshotState: "not_posted"
    });
  });
});

describe(detectProviderTierDemotion.name, () => {
  it("reports independent tier and snapshot eligibility decreases", () => {
    const currentSnapshot = {
      effectiveTier: VerificationTier.verification_tier_established,
      maxPlacementTier: VerificationTier.verification_tier_established,
      snapshotState: "current" as const
    };

    expect(
      detectProviderTierDemotion(currentSnapshot, {
        ...currentSnapshot,
        maxPlacementTier: VerificationTier.verification_tier_identified,
        snapshotState: "stale"
      })
    ).toEqual(["snapshot_eligibility"]);
    expect(
      detectProviderTierDemotion(currentSnapshot, {
        effectiveTier: VerificationTier.verification_tier_verified,
        maxPlacementTier: VerificationTier.verification_tier_verified,
        snapshotState: "current"
      })
    ).toEqual(["tier_gate", "snapshot_eligibility"]);
  });

  it("does not emit on an upgrade or unchanged state", () => {
    const previous = {
      effectiveTier: VerificationTier.verification_tier_identified,
      maxPlacementTier: VerificationTier.verification_tier_identified,
      snapshotState: "not_posted" as const
    };

    expect(detectProviderTierDemotion(previous, previous)).toEqual([]);
    expect(
      detectProviderTierDemotion(previous, {
        effectiveTier: VerificationTier.verification_tier_verified,
        maxPlacementTier: VerificationTier.verification_tier_verified,
        snapshotState: "current"
      })
    ).toEqual([]);
  });
});

function facts(overrides: Partial<ProviderVerificationFacts> = {}): ProviderVerificationFacts {
  return {
    attestations: [],
    graces: [],
    snapshot: null,
    completeness: { attestations: true, graces: true, snapshot: true },
    observedAt,
    observedHeight: "100",
    ...overrides
  };
}

function attestation(tier: VerificationTier): AttestationRecord {
  return {
    provider: "akash1provider",
    auditor: "akash1auditor",
    tier,
    capabilities: [],
    evidenceHash: new Uint8Array(),
    fee: undefined,
    feeStatus: 0,
    createdAt: undefined,
    expiresAt: undefined,
    status: AttestationStatus.attestation_status_valid,
    voidedReason: 0,
    deposit: undefined,
    depositStatus: 0,
    auditEscrowId: 0n,
    faultAttribution: 0
  };
}

function grace(preservedTier: VerificationTier): ProviderVerificationGraceRecord {
  return {
    id: 1n,
    provider: "akash1provider",
    preservedTier,
    sourceDiscrepancyIds: [],
    startedAt: undefined,
    expiresAt: undefined,
    status: VerificationGraceStatus.verification_grace_status_active
  };
}

function snapshot(overrides: Partial<ProviderSnapshotRecord> = {}): ProviderSnapshotRecord {
  return {
    provider: "akash1provider",
    snapshotHash: new Uint8Array(),
    resourceSummary: undefined,
    postedAt: undefined,
    snapshotTimestamp: undefined,
    complianceDeadline: new Date("2026-08-25T12:00:00.000Z"),
    suspended: false,
    ...overrides
  };
}
