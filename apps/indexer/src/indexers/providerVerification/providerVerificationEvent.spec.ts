import { describe, expect, it } from "vitest";

import { parseProviderVerificationEventImpact, PROVIDER_VERIFICATION_EVENT_TYPES, type ProviderVerificationEventImpact } from "./providerVerificationEvent";

const EMPTY_IMPACT: ProviderVerificationEventImpact = {
  providers: [],
  auditors: [],
  auditEscrowIds: [],
  discrepancyIds: [],
  graceIds: [],
  maintenance: []
};

const EXPECTED_EVENT_TYPES = [
  "akash.provider.v1beta4.EventProviderMaintenanceClosed",
  "akash.provider.v1beta4.EventProviderMaintenanceOpened",
  "akash.verification.v1.EventAttestationExpired",
  "akash.verification.v1.EventAttestationReplaced",
  "akash.verification.v1.EventAttestationRevoked",
  "akash.verification.v1.EventAttestationSubmitted",
  "akash.verification.v1.EventAttestationVoided",
  "akash.verification.v1.EventAuditEscrowOpened",
  "akash.verification.v1.EventAuditEscrowSettled",
  "akash.verification.v1.EventAuditorBondPosted",
  "akash.verification.v1.EventAuditorFrozen",
  "akash.verification.v1.EventAuditorLapsed",
  "akash.verification.v1.EventAuditorRegistered",
  "akash.verification.v1.EventAuditorRemoved",
  "akash.verification.v1.EventAuditorRenewed",
  "akash.verification.v1.EventAuditorResigned",
  "akash.verification.v1.EventDepositReturnedToAuditor",
  "akash.verification.v1.EventDepositSlashed",
  "akash.verification.v1.EventDiscrepancyDetected",
  "akash.verification.v1.EventDiscrepancyResolved",
  "akash.verification.v1.EventDiscrepancyTimedOut",
  "akash.verification.v1.EventFeeEscrowed",
  "akash.verification.v1.EventFeeReleasedToAuditor",
  "akash.verification.v1.EventFeeReturnedToProvider",
  "akash.verification.v1.EventProviderBondPosted",
  "akash.verification.v1.EventProviderBondSlashed",
  "akash.verification.v1.EventProviderBondWithdrawalCompleted",
  "akash.verification.v1.EventProviderBondWithdrawalInitiated",
  "akash.verification.v1.EventSnapshotHashPosted",
  "akash.verification.v1.EventSnapshotResumed",
  "akash.verification.v1.EventSnapshotSuspended",
  "akash.verification.v1.EventVerificationGraceEnded",
  "akash.verification.v1.EventVerificationGraceStarted"
];

describe("parseProviderVerificationEventImpact", () => {
  it("covers every verification and provider maintenance event declared by the SDK", () => {
    expect(PROVIDER_VERIFICATION_EVENT_TYPES).toEqual(EXPECTED_EVENT_TYPES);
  });

  it("parses an unordered persisted transaction event", () => {
    expect(
      parseProviderVerificationEventImpact({
        type: "akash.verification.v1.EventAttestationSubmitted",
        attributes: [
          { key: "tier", value: "verification_tier_identified" },
          { key: "audit_escrow_id", value: "41" },
          { key: "auditor", value: "akash1auditor" },
          { key: "provider", value: "akash1provider" }
        ]
      })
    ).toEqual({
      ...EMPTY_IMPACT,
      providers: ["akash1provider"],
      auditors: ["akash1auditor"],
      auditEscrowIds: ["41"]
    });
  });

  it("accepts a finalize-block event shape", () => {
    const event = {
      type: "akash.verification.v1.EventAttestationExpired",
      attributes: [
        { key: "auditor", value: "akash1auditor", index: true },
        { key: "provider", value: "akash1provider", index: true },
        { key: "tier", value: "verification_tier_identified", index: false }
      ]
    };

    expect(parseProviderVerificationEventImpact(event)).toEqual({
      ...EMPTY_IMPACT,
      providers: ["akash1provider"],
      auditors: ["akash1auditor"]
    });
  });

  it("decodes JSON-quoted typed-event values", () => {
    expect(
      parseProviderVerificationEventImpact({
        type: "akash.verification.v1.EventAuditorFrozen",
        attributes: [
          { key: "discrepancy_id", value: '"9007199254740993"' },
          { key: "auditor", value: '"akash1auditor"' }
        ]
      })
    ).toEqual({
      ...EMPTY_IMPACT,
      auditors: ["akash1auditor"],
      discrepancyIds: ["9007199254740993"]
    });
  });

  it("deduplicates repeated attributes and sorts each impact set", () => {
    expect(
      parseProviderVerificationEventImpact({
        type: "akash.verification.v1.EventDiscrepancyDetected",
        attributes: [
          { key: "auditor_b", value: "akash1z" },
          { key: "discrepancy_id", value: "9" },
          { key: "auditor_a", value: "akash1a" },
          { key: "provider", value: "akash1provider" },
          { key: "auditor_b", value: '"akash1z"' },
          { key: "discrepancy_id", value: '"9"' }
        ]
      })
    ).toEqual({
      ...EMPTY_IMPACT,
      providers: ["akash1provider"],
      auditors: ["akash1a", "akash1z"],
      discrepancyIds: ["9"]
    });
  });

  it("returns both escrow records affected by an attestation replacement", () => {
    expect(
      parseProviderVerificationEventImpact({
        type: "akash.verification.v1.EventAttestationReplaced",
        attributes: [
          { key: "new_audit_escrow_id", value: "12" },
          { key: "old_audit_escrow_id", value: "11" },
          { key: "provider", value: "akash1provider" },
          { key: "auditor", value: "akash1auditor" }
        ]
      })
    ).toEqual({
      ...EMPTY_IMPACT,
      providers: ["akash1provider"],
      auditors: ["akash1auditor"],
      auditEscrowIds: ["11", "12"]
    });
  });

  it("returns a maintenance record identity", () => {
    expect(
      parseProviderVerificationEventImpact({
        type: "akash.provider.v1beta4.EventProviderMaintenanceOpened",
        attributes: [
          { key: "maintenance_id", value: '"7"' },
          { key: "provider", value: '"akash1provider"' }
        ]
      })
    ).toEqual({
      ...EMPTY_IMPACT,
      maintenance: [{ provider: "akash1provider", maintenanceId: "7" }]
    });
  });

  it("returns only the grace identity when grace-ended omits the provider", () => {
    expect(
      parseProviderVerificationEventImpact({
        type: "akash.verification.v1.EventVerificationGraceEnded",
        attributes: [
          { key: "status", value: "verification_grace_status_expired" },
          { key: "grace_record_id", value: "25" }
        ]
      })
    ).toEqual({ ...EMPTY_IMPACT, graceIds: ["25"] });
  });

  it("returns no impact for unknown events", () => {
    expect(
      parseProviderVerificationEventImpact({
        type: "akash.verification.v1.EventAttestationRemoved",
        attributes: [{ key: "provider", value: "akash1provider" }]
      })
    ).toEqual(EMPTY_IMPACT);
  });
});
