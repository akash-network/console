import { AttestationStatus, CapabilityFlag, VerificationGraceStatus, VerificationTier } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import type { ProviderVerificationScreeningState } from "@akashnetwork/provider-verification";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { mapProviderVerification, mapStoredProviderVerificationFacts } from "./provider-verification-mapper";

describe(mapProviderVerification.name, () => {
  it("stores only the normalized facts required for screening", () => {
    const stored = mapProviderVerification({
      moduleActive: true,
      observedAt: new Date("2026-08-24T12:00:00.000Z"),
      observedHeight: "123",
      state: mock<ProviderVerificationScreeningState>({
        provider: "akash1provider",
        attestations: [
          mock({
            auditor: "akash1z",
            capabilities: [CapabilityFlag.capability_persistent_storage, CapabilityFlag.capability_bare_metal],
            status: AttestationStatus.attestation_status_valid,
            tier: VerificationTier.verification_tier_verified
          }),
          mock({
            auditor: "akash1a",
            capabilities: [],
            status: AttestationStatus.attestation_status_expired,
            tier: VerificationTier.verification_tier_identified
          })
        ],
        grace: mock({
          preservedTier: VerificationTier.verification_tier_established,
          status: VerificationGraceStatus.verification_grace_status_active
        }),
        snapshot: mock({ complianceDeadline: new Date("2026-08-25T12:00:00.000Z"), suspended: false })
      })
    });

    expect(stored).toEqual({
      moduleActive: true,
      facts: {
        attestations: [
          {
            auditor: "akash1a",
            capabilities: [],
            status: AttestationStatus.attestation_status_expired,
            tier: VerificationTier.verification_tier_identified
          },
          {
            auditor: "akash1z",
            capabilities: [CapabilityFlag.capability_persistent_storage, CapabilityFlag.capability_bare_metal],
            status: AttestationStatus.attestation_status_valid,
            tier: VerificationTier.verification_tier_verified
          }
        ],
        completeness: { attestations: true, graces: true, snapshot: true },
        graces: [
          {
            preservedTier: VerificationTier.verification_tier_established,
            status: VerificationGraceStatus.verification_grace_status_active
          }
        ],
        observedAt: "2026-08-24T12:00:00.000Z",
        observedHeight: "123",
        snapshot: { complianceDeadline: "2026-08-25T12:00:00.000Z", suspended: false }
      }
    });
  });

  it("represents unavailable provider queries as incomplete facts", () => {
    const stored = mapProviderVerification({
      moduleActive: null,
      observedAt: new Date("2026-08-24T12:00:00.000Z"),
      observedHeight: "123",
      state: null
    });

    expect(stored.facts.completeness).toEqual({ attestations: false, graces: false, snapshot: false });
    expect(stored.facts.attestations).toEqual([]);
    expect(stored.facts.graces).toEqual([]);
    expect(stored.facts.snapshot).toBeNull();
  });

  it("hydrates persisted timestamps for the shared evaluator", () => {
    const stored = mapProviderVerification({
      moduleActive: true,
      observedAt: new Date("2026-08-24T12:00:00.000Z"),
      observedHeight: "123",
      state: mock<ProviderVerificationScreeningState>({
        attestations: [],
        grace: null,
        snapshot: mock({ complianceDeadline: new Date("2026-08-25T12:00:00.000Z"), suspended: false })
      })
    });

    const facts = mapStoredProviderVerificationFacts(stored);

    expect(facts.observedAt).toEqual(new Date("2026-08-24T12:00:00.000Z"));
    expect(facts.snapshot?.complianceDeadline).toEqual(new Date("2026-08-25T12:00:00.000Z"));
  });
});
