import type { AttestationRecord, ProviderVerificationGraceRecord, VerificationRequirement } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import {
  AttestationStatus,
  AuditorSelectionMode,
  CapabilityFlag,
  VerificationGraceStatus,
  VerificationTier
} from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { describe, expect, it } from "vitest";

import { deriveProviderVerificationSummary, evaluateProviderVerification, type ProviderVerificationFacts } from "./providerVerification.js";

const observedAt = new Date("2026-08-24T12:00:00.000Z");

describe("deriveProviderVerificationSummary", () => {
  it("matches the market keeper by using stored-valid attestations regardless of auditor lifecycle or expires_at", () => {
    const facts = createFacts({
      attestations: [
        createAttestation({ auditor: "auditor-b", tier: VerificationTier.verification_tier_verified, capabilities: [CapabilityFlag.capability_bare_metal] }),
        createAttestation({
          auditor: "auditor-a",
          tier: VerificationTier.verification_tier_established,
          capabilities: [CapabilityFlag.capability_persistent_storage]
        }),
        createAttestation({
          auditor: "auditor-c",
          status: AttestationStatus.attestation_status_expired,
          tier: VerificationTier.verification_tier_trusted,
          capabilities: [CapabilityFlag.capability_confidential_computing]
        })
      ]
    });

    expect(deriveProviderVerificationSummary(facts)).toMatchObject({
      bestStatusValidTier: VerificationTier.verification_tier_established,
      tierGateTier: VerificationTier.verification_tier_established,
      capabilities: [CapabilityFlag.capability_persistent_storage, CapabilityFlag.capability_bare_metal],
      validAttestationCount: 2,
      validAuditors: ["auditor-a", "auditor-b"]
    });
  });

  it("uses active grace only for the tier gate", () => {
    const facts = createFacts({
      attestations: [createAttestation({ tier: VerificationTier.verification_tier_identified, capabilities: [CapabilityFlag.capability_persistent_storage] })],
      graces: [createGrace(VerificationTier.verification_tier_established)]
    });

    expect(deriveProviderVerificationSummary(facts)).toMatchObject({
      bestStatusValidTier: VerificationTier.verification_tier_identified,
      tierGateTier: VerificationTier.verification_tier_established,
      capabilities: [CapabilityFlag.capability_persistent_storage]
    });
  });
});

describe("evaluateProviderVerification", () => {
  it("does not enforce a vacuous requirement", () => {
    const result = evaluateProviderVerification({
      moduleActive: null,
      requirement: createRequirement({ minTier: VerificationTier.verification_tier_unspecified }),
      facts: createFacts()
    });

    expect(result.outcome).toBe("pass");
  });

  it("does not enforce verification while the chain module is inactive", () => {
    const result = evaluateProviderVerification({
      moduleActive: false,
      requirement: createRequirement({ minTier: VerificationTier.verification_tier_trusted }),
      facts: createFacts({ completeness: { attestations: false, graces: false, snapshot: false } })
    });

    expect(result.outcome).toBe("pass");
  });

  it("returns unknown instead of excluding a provider when required facts are incomplete", () => {
    const result = evaluateProviderVerification({
      moduleActive: true,
      requirement: createRequirement({ minTier: VerificationTier.verification_tier_verified }),
      facts: createFacts({ completeness: { attestations: true, graces: false, snapshot: false } })
    });

    expect(result).toMatchObject({ outcome: "unknown", incompleteFacts: ["graces", "snapshot"] });
  });

  it("checks snapshot before tier and retains the full failure set", () => {
    const result = evaluateProviderVerification({
      moduleActive: true,
      requirement: createRequirement({
        minTier: VerificationTier.verification_tier_verified,
        requiredCapabilities: [CapabilityFlag.capability_persistent_storage],
        minAuditorCount: 2
      }),
      facts: createFacts()
    });

    expect(result.outcome).toBe("fail");
    if (result.outcome !== "fail") throw new Error("expected failure");
    expect(result.firstFailure.code).toBe("snapshot_not_posted");
    expect(result.failures.map(failure => failure.code)).toEqual([
      "snapshot_not_posted",
      "insufficient_tier",
      "missing_capability",
      "insufficient_auditor_count"
    ]);
  });

  it("matches capability union and tier-qualified auditor semantics", () => {
    const result = evaluateProviderVerification({
      moduleActive: true,
      requirement: createRequirement({
        minTier: VerificationTier.verification_tier_verified,
        requiredCapabilities: [CapabilityFlag.capability_persistent_storage, CapabilityFlag.capability_bare_metal],
        requiredAuditors: ["auditor-l2", "auditor-l1"],
        auditorMode: AuditorSelectionMode.auditor_selection_mode_any,
        minAuditorCount: 1
      }),
      facts: createFacts({
        attestations: [
          createAttestation({ auditor: "auditor-l2", tier: VerificationTier.verification_tier_verified, capabilities: [CapabilityFlag.capability_bare_metal] }),
          createAttestation({
            auditor: "auditor-l1",
            tier: VerificationTier.verification_tier_identified,
            capabilities: [CapabilityFlag.capability_persistent_storage]
          })
        ],
        snapshot: { complianceDeadline: new Date("2026-08-25T12:00:00.000Z"), suspended: false }
      })
    });

    expect(result).toMatchObject({ outcome: "pass", qualifiedAuditors: ["auditor-l2"] });
  });

  it("treats unspecified auditor mode as any and reports all missing auditors for all mode", () => {
    const facts = createFacts({ attestations: [createAttestation({ auditor: "auditor-a" })] });
    const anyResult = evaluateProviderVerification({
      moduleActive: true,
      requirement: createRequirement({ requiredAuditors: ["auditor-a", "auditor-b"] }),
      facts
    });
    const allResult = evaluateProviderVerification({
      moduleActive: true,
      requirement: createRequirement({ requiredAuditors: ["auditor-a", "auditor-b"], auditorMode: AuditorSelectionMode.auditor_selection_mode_all }),
      facts
    });

    expect(anyResult.outcome).toBe("pass");
    expect(allResult).toMatchObject({
      outcome: "fail",
      firstFailure: { code: "required_auditor_not_found", missing: ["auditor-b"] }
    });
  });

  it("does not add a provider-bond check that the market BidFilter does not perform", () => {
    const result = evaluateProviderVerification({
      moduleActive: true,
      requirement: createRequirement({ minTier: VerificationTier.verification_tier_verified }),
      facts: createFacts({
        attestations: [createAttestation({ tier: VerificationTier.verification_tier_verified })],
        snapshot: { complianceDeadline: new Date("2026-08-25T12:00:00.000Z"), suspended: false }
      })
    });

    expect(result.outcome).toBe("pass");
  });

  it("uses the snapshot compliance deadline even before suspension is persisted", () => {
    const result = evaluateProviderVerification({
      moduleActive: true,
      requirement: createRequirement({ minTier: VerificationTier.verification_tier_verified }),
      facts: createFacts({
        attestations: [createAttestation({ tier: VerificationTier.verification_tier_verified })],
        snapshot: { complianceDeadline: observedAt, suspended: false }
      })
    });

    expect(result).toMatchObject({ outcome: "fail", firstFailure: { code: "snapshot_stale" } });
  });

  it("does not let an active grace bypass L2 snapshot suspension", () => {
    const result = evaluateProviderVerification({
      moduleActive: true,
      requirement: createRequirement({ minTier: VerificationTier.verification_tier_verified }),
      facts: createFacts({
        graces: [createGrace(VerificationTier.verification_tier_verified)],
        snapshot: { complianceDeadline: new Date("2026-08-25T12:00:00.000Z"), suspended: true }
      })
    });

    expect(result).toMatchObject({
      outcome: "fail",
      firstFailure: { code: "snapshot_suspended" },
      failures: [{ code: "snapshot_suspended" }]
    });
  });

  it("keeps eligibility when a partial bond slash leaves the attestation valid", () => {
    const result = evaluateProviderVerification({
      moduleActive: true,
      requirement: createRequirement({ minTier: VerificationTier.verification_tier_verified }),
      facts: createFacts({
        attestations: [createAttestation({ tier: VerificationTier.verification_tier_verified })],
        snapshot: { complianceDeadline: new Date("2026-08-25T12:00:00.000Z"), suspended: false }
      })
    });

    expect(result.outcome).toBe("pass");
  });
});

function createFacts(overrides: Partial<ProviderVerificationFacts> = {}): ProviderVerificationFacts {
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

function createAttestation(overrides: Partial<AttestationRecord> = {}): AttestationRecord {
  return {
    provider: "provider",
    auditor: "auditor",
    tier: VerificationTier.verification_tier_identified,
    capabilities: [],
    evidenceHash: new Uint8Array(),
    fee: undefined,
    feeStatus: 0,
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
    expiresAt: new Date("2025-01-02T00:00:00.000Z"),
    status: AttestationStatus.attestation_status_valid,
    voidedReason: 0,
    deposit: undefined,
    depositStatus: 0,
    auditEscrowId: 1n,
    faultAttribution: 0,
    ...overrides
  };
}

function createGrace(preservedTier: VerificationTier): ProviderVerificationGraceRecord {
  return {
    id: 1n,
    provider: "provider",
    preservedTier,
    sourceDiscrepancyIds: [1n],
    startedAt: observedAt,
    expiresAt: new Date("2026-08-25T12:00:00.000Z"),
    status: VerificationGraceStatus.verification_grace_status_active
  };
}

function createRequirement(overrides: Partial<VerificationRequirement> = {}): VerificationRequirement {
  return {
    minTier: VerificationTier.verification_tier_identified,
    requiredCapabilities: [],
    requiredAuditors: [],
    auditorMode: AuditorSelectionMode.auditor_selection_mode_unspecified,
    minAuditorCount: 0,
    ...overrides
  };
}
