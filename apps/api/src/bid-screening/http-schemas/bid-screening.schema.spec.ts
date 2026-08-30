import { AuditorSelectionMode, CapabilityFlag, VerificationTier } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { describe, expect, it } from "vitest";

import { BidScreeningRequestSchema, BidScreeningResponseSchema } from "./bid-screening.schema";

describe("BidScreeningRequestSchema", () => {
  it("accepts the canonical verification requirement and preserves its enum values", () => {
    const result = BidScreeningRequestSchema.parse(createRequest());

    expect(result.requirements.verification).toEqual({
      minTier: VerificationTier.verification_tier_verified,
      requiredCapabilities: [CapabilityFlag.capability_persistent_storage],
      requiredAuditors: ["akash1auditor"],
      auditorMode: AuditorSelectionMode.auditor_selection_mode_all,
      minAuditorCount: 2
    });
    expect(result.resources[0].resource.endpoints).toEqual([{ kind: "SHARED_HTTP", sequenceNumber: 1 }]);
  });

  it("rejects enum values outside the chain contract", () => {
    const request = createRequest();
    request.requirements.verification.minTier = 99 as VerificationTier;
    request.requirements.verification.requiredCapabilities = [CapabilityFlag.capability_unspecified];

    expect(BidScreeningRequestSchema.safeParse(request).success).toBe(false);
  });
});

describe("BidScreeningResponseSchema", () => {
  it("accepts pass, not-evaluated, and exclusion results", () => {
    const summary = createVerificationSummary();
    const response = {
      providers: [
        createProvider({ outcome: "pass", summary }),
        createProvider({ outcome: "not_evaluated", incompleteFacts: ["snapshot", "attestations"], summary })
      ],
      exclusions: [
        {
          owner: "akash1excluded",
          firstFailure: {
            code: "insufficient_tier",
            actual: VerificationTier.verification_tier_identified,
            required: VerificationTier.verification_tier_verified
          },
          failures: [
            {
              code: "insufficient_tier",
              actual: VerificationTier.verification_tier_identified,
              required: VerificationTier.verification_tier_verified
            },
            { code: "missing_capability", capability: CapabilityFlag.capability_persistent_storage }
          ],
          summary
        }
      ]
    };

    expect(BidScreeningResponseSchema.parse(response)).toEqual(response);
  });

  it("rejects exclusion enum values outside the chain contract", () => {
    const summary = createVerificationSummary();
    const response = {
      providers: [],
      exclusions: [
        {
          owner: "akash1excluded",
          firstFailure: { code: "required_auditor_not_found", mode: 99, missing: ["akash1auditor"] },
          failures: [{ code: "required_auditor_not_found", mode: 99, missing: ["akash1auditor"] }],
          summary
        }
      ]
    };

    expect(BidScreeningResponseSchema.safeParse(response).success).toBe(false);
  });
});

function createRequest() {
  return {
    requirements: {
      signedBy: { allOf: ["akash1legacy"], anyOf: ["akash1existing"] },
      attributes: [{ key: "region", value: "us-west" }],
      verification: {
        minTier: VerificationTier.verification_tier_verified,
        requiredCapabilities: [CapabilityFlag.capability_persistent_storage],
        requiredAuditors: ["akash1auditor"],
        auditorMode: AuditorSelectionMode.auditor_selection_mode_all,
        minAuditorCount: 2
      }
    },
    resources: [
      {
        resource: {
          id: 1,
          cpu: { units: { val: "1000" } },
          memory: { quantity: { val: "1048576" } },
          gpu: { units: { val: "0" } },
          storage: [{ name: "default", quantity: { val: "1073741824" } }],
          endpoints: [{ kind: "SHARED_HTTP" as const, sequenceNumber: "1" }]
        },
        count: 1,
        price: { denom: "uakt", amount: "1000" }
      }
    ],
    timezone: "UTC"
  };
}

function createVerificationSummary() {
  return {
    bestStatusValidTier: VerificationTier.verification_tier_verified,
    tierGateTier: VerificationTier.verification_tier_verified,
    capabilities: [CapabilityFlag.capability_persistent_storage],
    validAttestationCount: 2,
    validAuditors: ["akash1auditor", "akash1auditor2"],
    snapshotState: "current" as const,
    observedHeight: "1234"
  };
}

function createProvider(verification: Record<string, unknown>) {
  return {
    owner: "akash1provider",
    hostUri: "https://provider.example.com:8443",
    isAudited: true,
    createdAt: "2026-08-24T00:00:00.000Z",
    location: "us-west",
    organization: "Akash",
    verification,
    incidents: []
  };
}
