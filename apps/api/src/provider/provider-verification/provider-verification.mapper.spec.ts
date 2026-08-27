import type {
  AttestationRecord,
  AuditEscrowRecord,
  DiscrepancyEvent,
  ProviderSnapshotRecord,
  ProviderVerificationGraceRecord
} from "@akashnetwork/chain-sdk/private-types/akash.v1";
import {
  AttestationStatus,
  AuditEscrowSettlementReason,
  AuditEscrowStatus,
  CapabilityFlag,
  DepositStatus,
  DiscrepancyResolutionReason,
  DiscrepancyStatus,
  FaultAttribution,
  FeeStatus,
  ProviderDepositStatus,
  VerificationGraceStatus,
  VerificationTier,
  VoidedReason
} from "@akashnetwork/chain-sdk/private-types/akash.v1";
import type { ProviderMaintenanceWithStatus } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { ProviderMaintenanceStatus, ProviderMaintenanceType } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import type { ProviderVerificationFacts } from "@akashnetwork/provider-verification";
import { describe, expect, it } from "vitest";

import {
  mapProviderVerificationListView,
  mapProviderVerificationView,
  type MapProviderVerificationViewInput,
  type ProviderBondWithRequirement
} from "./provider-verification.mapper";
import { ProviderVerificationListViewSchema, ProviderVerificationViewSchema } from "./provider-verification.schema";

const PROVIDER = "akash1provider";
const OBSERVED_AT = new Date("2026-08-24T12:00:00.000Z");

describe(mapProviderVerificationListView.name, () => {
  it("returns only provider-list verification facts", () => {
    const detail = completeInput();
    const view = mapProviderVerificationListView({
      provider: detail.provider,
      moduleActive: detail.moduleActive,
      facts: detail.facts,
      maintenanceStatuses: detail.records.maintenance.map(item => item.status),
      discrepancyStatuses: detail.records.discrepancies.map(item => item.resolutionStatus),
      graceStatus: detail.records.grace?.status ?? null,
      completeness: {
        params: detail.completeness.params,
        maintenance: detail.completeness.maintenance,
        discrepancies: detail.completeness.discrepancies
      }
    });

    expect(ProviderVerificationListViewSchema.parse(view)).toEqual(view);
    expect(view).toEqual({
      provider: PROVIDER,
      moduleActive: true,
      summary: {
        effectiveTier: "L3",
        validAuditorCount: 1,
        capabilities: ["persistent_storage"],
        snapshotState: "current",
        maintenanceState: "active",
        reviewState: "under_review"
      },
      observedAt: "2026-08-24T12:00:00.000Z",
      observedHeight: "12345"
    });
  });
});

describe(mapProviderVerificationView.name, () => {
  it("maps chain facts and current records into a JSON-safe, truth-labeled view", () => {
    const input = completeInput();

    const view = mapProviderVerificationView(input);

    expect(ProviderVerificationViewSchema.parse(view)).toEqual(view);
    expect(JSON.parse(JSON.stringify(view))).toEqual(view);
    expect(view).toMatchObject({
      provider: PROVIDER,
      providerDeclaredTier: "community",
      moduleActive: true,
      provenance: {
        providerTier: "provider self-declared",
        inventory: "provider-signed inventory",
        attestations: "auditor-attested"
      },
      summary: {
        bestAttestedTier: "L2",
        effectiveTier: "L3",
        capabilities: ["persistent_storage"],
        validAttestationCount: 1,
        validAuditorCount: 1,
        validAuditors: ["akash1auditor-a"],
        snapshotState: "current",
        maintenanceState: "active",
        reviewState: "under_review"
      },
      observedAt: "2026-08-24T12:00:00.000Z",
      observedHeight: "12345"
    });
    expect(view.attestations).toHaveLength(2);
    expect(view.attestations[0]).toMatchObject({
      auditor: "akash1auditor-a",
      tier: "L2",
      capabilities: ["persistent_storage"],
      evidenceHash: "AQID",
      status: "valid",
      auditEscrowId: "9"
    });
    expect(view.snapshot).toMatchObject({
      snapshotHash: "BwgJ",
      resourceSummary: {
        totalMemoryMb: "32768",
        totalStorageMb: "1048576",
        softwareSignature: "Cg==",
        softwareIdentity: {
          digest: "Cw==",
          signature: "DA=="
        }
      }
    });
    expect(view.bond).toMatchObject({
      bondedAmount: { denom: "uakt", amount: "500000000" },
      requiredForCurrentTier: { denom: "uakt", amount: "400000000" },
      slashed: false
    });
    expect(view.auditEscrows[0]).toMatchObject({ id: "11", status: "settled", consumedByAuditor: null });
    expect(view.maintenance[0]).toMatchObject({ record: { id: "4", maintenanceType: "planned" }, status: "active" });
    expect(view.discrepancies[0]).toMatchObject({ id: "5", resolutionStatus: "pending", auditorATier: "L1", auditorBTier: "L3" });
  });

  it("uses null and unknown instead of presenting incomplete indexed facts as verified", () => {
    const input = completeInput();
    input.moduleActive = true;
    input.facts = {
      attestations: [],
      graces: [],
      snapshot: null,
      completeness: { attestations: false, graces: false, snapshot: false },
      observedAt: OBSERVED_AT,
      observedHeight: "12346"
    };
    input.records = {
      attestations: [],
      bond: null,
      snapshot: null,
      grace: null,
      auditEscrows: [],
      maintenance: [],
      discrepancies: []
    };
    input.completeness = { params: false, bond: false, auditEscrows: false, maintenance: false, discrepancies: false };

    const view = mapProviderVerificationView(input);

    expect(view.moduleActive).toBeNull();
    expect(view.summary).toEqual({
      bestAttestedTier: null,
      effectiveTier: null,
      capabilities: null,
      validAttestationCount: null,
      validAuditorCount: null,
      validAuditors: null,
      snapshotState: "unknown",
      maintenanceState: "unknown",
      reviewState: "unknown"
    });
    expect(view).toMatchObject({
      attestations: [],
      bond: null,
      snapshot: null,
      grace: null,
      auditEscrows: [],
      maintenance: [],
      discrepancies: []
    });
    expect(ProviderVerificationViewSchema.safeParse(view).success).toBe(true);
  });

  it("reports active grace after a discrepancy is no longer pending", () => {
    const input = completeInput();
    input.records.discrepancies[0].resolutionStatus = DiscrepancyStatus.discrepancy_status_resolved;

    const view = mapProviderVerificationView(input);

    expect(view.summary.reviewState).toBe("grace");
  });

  it("keeps records for other providers out of a provider-scoped view", () => {
    const input = completeInput();
    input.records.attestations = [...input.records.attestations, attestation({ provider: "akash1other", auditor: "akash1other-auditor" })];
    input.records.auditEscrows = [...input.records.auditEscrows, escrow({ provider: "akash1other", id: 99n })];
    input.records.discrepancies = [...input.records.discrepancies, discrepancy({ provider: "akash1other", id: 99n })];

    const view = mapProviderVerificationView(input);

    expect(view.attestations).toHaveLength(2);
    expect(view.auditEscrows).toHaveLength(1);
    expect(view.discrepancies).toHaveLength(1);
  });
});

function completeInput(): MapProviderVerificationViewInput {
  const validAttestation = attestation({
    auditor: "akash1auditor-a",
    tier: VerificationTier.verification_tier_verified,
    capabilities: [CapabilityFlag.capability_persistent_storage],
    evidenceHash: Uint8Array.from([1, 2, 3]),
    createdAt: new Date("2026-08-23T12:00:00.000Z"),
    expiresAt: new Date("2027-08-23T12:00:00.000Z"),
    status: AttestationStatus.attestation_status_valid,
    auditEscrowId: 9n
  });
  const expiredAttestation = attestation({
    auditor: "akash1auditor-b",
    tier: VerificationTier.verification_tier_trusted,
    createdAt: new Date("2026-08-22T12:00:00.000Z"),
    expiresAt: new Date("2026-08-23T12:00:00.000Z"),
    status: AttestationStatus.attestation_status_expired,
    auditEscrowId: 8n
  });
  const grace = verificationGrace();
  const snapshot = providerSnapshot();
  const facts: ProviderVerificationFacts = {
    attestations: [validAttestation, expiredAttestation],
    graces: [grace],
    snapshot,
    completeness: { attestations: true, graces: true, snapshot: true },
    observedAt: OBSERVED_AT,
    observedHeight: "12345"
  };

  return {
    provider: PROVIDER,
    providerDeclaredTier: "community",
    moduleActive: true,
    facts,
    records: {
      attestations: [expiredAttestation, validAttestation],
      bond: providerBond(),
      snapshot,
      grace,
      auditEscrows: [escrow()],
      maintenance: [providerMaintenance()],
      discrepancies: [discrepancy()]
    },
    completeness: { params: true, bond: true, auditEscrows: true, maintenance: true, discrepancies: true }
  };
}

function attestation(overrides: Partial<AttestationRecord> = {}): AttestationRecord {
  return {
    provider: PROVIDER,
    auditor: "akash1auditor",
    tier: VerificationTier.verification_tier_identified,
    capabilities: [],
    evidenceHash: new Uint8Array(),
    fee: { denom: "uakt", amount: "10000000" },
    feeStatus: FeeStatus.fee_status_escrowed,
    createdAt: OBSERVED_AT,
    expiresAt: new Date("2027-08-24T12:00:00.000Z"),
    status: AttestationStatus.attestation_status_valid,
    voidedReason: VoidedReason.voided_reason_unspecified,
    deposit: { denom: "uakt", amount: "100000000" },
    depositStatus: DepositStatus.deposit_status_escrowed,
    auditEscrowId: 1n,
    faultAttribution: FaultAttribution.fault_attribution_unspecified,
    ...overrides
  };
}

function providerBond(): ProviderBondWithRequirement {
  return {
    provider: PROVIDER,
    bondedAmount: { denom: "uakt", amount: "500000000" },
    requiredForCurrentTier: { denom: "uakt", amount: "400000000" },
    unbondingEntries: [{ amount: { denom: "uakt", amount: "100" }, completionTime: new Date("2026-08-30T12:00:00.000Z") }],
    slashed: false,
    lastSlashTime: undefined
  };
}

function providerSnapshot(): ProviderSnapshotRecord {
  return {
    provider: PROVIDER,
    snapshotHash: Uint8Array.from([7, 8, 9]),
    resourceSummary: {
      totalGpus: 1,
      totalVcpus: 8,
      totalMemoryMb: 32768n,
      totalStorageMb: 1048576n,
      activeLeases: 3,
      softwareVersion: "v0.16.0-a4",
      softwareSignature: Uint8Array.from([10]),
      softwareIdentity: {
        version: "v0.16.0-a4",
        artifactRef: "provider-linux-amd64",
        digestAlgorithm: "sha3-256",
        digest: Uint8Array.from([11]),
        signatureType: "cosign",
        signature: Uint8Array.from([12]),
        signatureRef: "oci://provider.sig",
        publicKeyRef: "https://example.com/provider.pub"
      }
    },
    postedAt: new Date("2026-08-24T11:00:00.000Z"),
    snapshotTimestamp: new Date("2026-08-24T10:59:00.000Z"),
    complianceDeadline: new Date("2026-08-25T11:00:00.000Z"),
    suspended: false
  };
}

function verificationGrace(): ProviderVerificationGraceRecord {
  return {
    id: 3n,
    provider: PROVIDER,
    preservedTier: VerificationTier.verification_tier_established,
    sourceDiscrepancyIds: [5n],
    startedAt: new Date("2026-08-24T10:00:00.000Z"),
    expiresAt: new Date("2026-08-26T10:00:00.000Z"),
    status: VerificationGraceStatus.verification_grace_status_active
  };
}

function escrow(overrides: Partial<AuditEscrowRecord> = {}): AuditEscrowRecord {
  return {
    id: 11n,
    provider: PROVIDER,
    consumedByAuditor: "",
    requestedTier: VerificationTier.verification_tier_verified,
    requestedCapabilities: [CapabilityFlag.capability_persistent_storage],
    fee: { denom: "uakt", amount: "50000000" },
    feeStatus: FeeStatus.fee_status_released_to_auditor,
    providerDeposit: { denom: "uakt", amount: "100000000" },
    providerDepositStatus: ProviderDepositStatus.provider_deposit_status_returned_to_provider,
    status: AuditEscrowStatus.audit_escrow_status_settled,
    openedAt: new Date("2026-08-20T12:00:00.000Z"),
    consumedAt: new Date("2026-08-21T12:00:00.000Z"),
    expiresAt: new Date("2026-08-22T12:00:00.000Z"),
    metadataHash: new Uint8Array(),
    settlementReason: AuditEscrowSettlementReason.audit_escrow_settlement_reason_no_fault,
    faultAttribution: FaultAttribution.fault_attribution_no_fault,
    ...overrides
  };
}

function providerMaintenance(): ProviderMaintenanceWithStatus {
  return {
    record: {
      id: 4n,
      provider: PROVIDER,
      maintenanceType: ProviderMaintenanceType.provider_maintenance_type_planned,
      startsAt: new Date("2026-08-24T11:30:00.000Z"),
      expectedEndsAt: new Date("2026-08-24T13:30:00.000Z"),
      openedAt: new Date("2026-08-23T12:00:00.000Z"),
      closedAt: undefined,
      metadataHash: Uint8Array.from([13])
    },
    status: ProviderMaintenanceStatus.provider_maintenance_status_active
  };
}

function discrepancy(overrides: Partial<DiscrepancyEvent> = {}): DiscrepancyEvent {
  return {
    id: 5n,
    provider: PROVIDER,
    auditorA: "akash1auditor-a",
    auditorATier: VerificationTier.verification_tier_identified,
    auditorB: "akash1auditor-b",
    auditorBTier: VerificationTier.verification_tier_established,
    timestamp: new Date("2026-08-24T10:00:00.000Z"),
    resolutionStatus: DiscrepancyStatus.discrepancy_status_pending,
    resolutionProposalId: 0n,
    graceRecordId: 3n,
    resolutionReason: DiscrepancyResolutionReason.discrepancy_resolution_reason_unspecified,
    faultAttribution: FaultAttribution.fault_attribution_unspecified,
    resolutionEvidenceHash: new Uint8Array(),
    ...overrides
  };
}
