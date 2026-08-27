import type {
  AttestationRecord,
  AuditEscrowRecord,
  DiscrepancyEvent,
  ProviderBondRecord,
  ProviderSnapshotRecord,
  ProviderVerificationGraceRecord,
  ResourceSummary,
  SoftwareIdentity
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
import type { ProviderMaintenanceRecord, ProviderMaintenanceWithStatus } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { ProviderMaintenanceStatus, ProviderMaintenanceType } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { deriveProviderVerificationSummary, type ProviderVerificationFacts } from "@akashnetwork/provider-verification";

import type {
  ProviderVerificationCapability,
  ProviderVerificationListView,
  ProviderVerificationTier,
  ProviderVerificationView,
  ProviderVerificationViewCompleteness
} from "./provider-verification.schema";

type AttestationView = ProviderVerificationView["attestations"][number];
type EscrowView = ProviderVerificationView["auditEscrows"][number];
type MaintenanceView = ProviderVerificationView["maintenance"][number];
type DiscrepancyView = ProviderVerificationView["discrepancies"][number];

const CAPABILITY_BY_VALUE: Readonly<Partial<Record<number, AttestationView["capabilities"][number]>>> = {
  [CapabilityFlag.capability_unspecified]: "unspecified",
  [CapabilityFlag.capability_tee_hardware_attestation]: "tee_hardware_attestation",
  [CapabilityFlag.capability_confidential_computing]: "confidential_computing",
  [CapabilityFlag.capability_persistent_storage]: "persistent_storage",
  [CapabilityFlag.capability_bare_metal]: "bare_metal"
};
const ATTESTATION_STATUS_BY_VALUE: Readonly<Partial<Record<number, AttestationView["status"]>>> = {
  [AttestationStatus.attestation_status_unspecified]: "unspecified",
  [AttestationStatus.attestation_status_valid]: "valid",
  [AttestationStatus.attestation_status_voided]: "voided",
  [AttestationStatus.attestation_status_expired]: "expired",
  [AttestationStatus.attestation_status_revoked]: "revoked",
  [AttestationStatus.attestation_status_removed]: "removed"
};
const VOIDED_REASON_BY_VALUE: Readonly<Partial<Record<number, AttestationView["voidedReason"]>>> = {
  [VoidedReason.voided_reason_unspecified]: "unspecified",
  [VoidedReason.voided_reason_discrepancy]: "discrepancy",
  [VoidedReason.voided_reason_governance]: "governance",
  [VoidedReason.voided_reason_bond_withdrawn]: "bond_withdrawn",
  [VoidedReason.voided_reason_bond_slashed]: "bond_slashed"
};
const FEE_STATUS_BY_VALUE: Readonly<Partial<Record<number, AttestationView["feeStatus"]>>> = {
  [FeeStatus.fee_status_unspecified]: "unspecified",
  [FeeStatus.fee_status_escrowed]: "escrowed",
  [FeeStatus.fee_status_released_to_auditor]: "released_to_auditor",
  [FeeStatus.fee_status_returned_to_provider]: "returned_to_provider"
};
const DEPOSIT_STATUS_BY_VALUE: Readonly<Partial<Record<number, AttestationView["depositStatus"]>>> = {
  [DepositStatus.deposit_status_unspecified]: "unspecified",
  [DepositStatus.deposit_status_escrowed]: "escrowed",
  [DepositStatus.deposit_status_pending_discrepancy]: "pending_discrepancy",
  [DepositStatus.deposit_status_returned_to_auditor]: "returned_to_auditor",
  [DepositStatus.deposit_status_slashed]: "slashed"
};
const PROVIDER_DEPOSIT_STATUS_BY_VALUE: Readonly<Partial<Record<number, EscrowView["providerDepositStatus"]>>> = {
  [ProviderDepositStatus.provider_deposit_status_unspecified]: "unspecified",
  [ProviderDepositStatus.provider_deposit_status_escrowed]: "escrowed",
  [ProviderDepositStatus.provider_deposit_status_returned_to_provider]: "returned_to_provider",
  [ProviderDepositStatus.provider_deposit_status_slashed]: "slashed"
};
const FAULT_ATTRIBUTION_BY_VALUE: Readonly<Partial<Record<number, AttestationView["faultAttribution"]>>> = {
  [FaultAttribution.fault_attribution_unspecified]: "unspecified",
  [FaultAttribution.fault_attribution_provider_fault]: "provider_fault",
  [FaultAttribution.fault_attribution_auditor_fault]: "auditor_fault",
  [FaultAttribution.fault_attribution_shared_fault]: "shared_fault",
  [FaultAttribution.fault_attribution_no_fault]: "no_fault",
  [FaultAttribution.fault_attribution_inconclusive]: "inconclusive"
};
const ESCROW_STATUS_BY_VALUE: Readonly<Partial<Record<number, EscrowView["status"]>>> = {
  [AuditEscrowStatus.audit_escrow_status_unspecified]: "unspecified",
  [AuditEscrowStatus.audit_escrow_status_open]: "open",
  [AuditEscrowStatus.audit_escrow_status_consumed]: "consumed",
  [AuditEscrowStatus.audit_escrow_status_cancelled]: "cancelled",
  [AuditEscrowStatus.audit_escrow_status_expired]: "expired",
  [AuditEscrowStatus.audit_escrow_status_settled]: "settled"
};
const ESCROW_SETTLEMENT_REASON_BY_VALUE: Readonly<Partial<Record<number, EscrowView["settlementReason"]>>> = {
  [AuditEscrowSettlementReason.audit_escrow_settlement_reason_unspecified]: "unspecified",
  [AuditEscrowSettlementReason.audit_escrow_settlement_reason_cancelled_unconsumed]: "cancelled_unconsumed",
  [AuditEscrowSettlementReason.audit_escrow_settlement_reason_expired_unconsumed]: "expired_unconsumed",
  [AuditEscrowSettlementReason.audit_escrow_settlement_reason_provider_fault]: "provider_fault",
  [AuditEscrowSettlementReason.audit_escrow_settlement_reason_no_fault]: "no_fault"
};
const GRACE_STATUS_BY_VALUE: Readonly<Partial<Record<number, NonNullable<ProviderVerificationView["grace"]>["status"]>>> = {
  [VerificationGraceStatus.verification_grace_status_unspecified]: "unspecified",
  [VerificationGraceStatus.verification_grace_status_active]: "active",
  [VerificationGraceStatus.verification_grace_status_expired]: "expired",
  [VerificationGraceStatus.verification_grace_status_terminated]: "terminated"
};
const MAINTENANCE_TYPE_BY_VALUE: Readonly<Partial<Record<number, NonNullable<MaintenanceView["record"]>["maintenanceType"]>>> = {
  [ProviderMaintenanceType.provider_maintenance_type_unspecified]: "unspecified",
  [ProviderMaintenanceType.provider_maintenance_type_planned]: "planned",
  [ProviderMaintenanceType.provider_maintenance_type_emergency]: "emergency",
  [ProviderMaintenanceType.provider_maintenance_type_security]: "security",
  [ProviderMaintenanceType.provider_maintenance_type_network]: "network",
  [ProviderMaintenanceType.provider_maintenance_type_capacity]: "capacity"
};
const MAINTENANCE_STATUS_BY_VALUE: Readonly<Partial<Record<number, MaintenanceView["status"]>>> = {
  [ProviderMaintenanceStatus.provider_maintenance_status_unspecified]: "unspecified",
  [ProviderMaintenanceStatus.provider_maintenance_status_scheduled]: "scheduled",
  [ProviderMaintenanceStatus.provider_maintenance_status_active]: "active",
  [ProviderMaintenanceStatus.provider_maintenance_status_elapsed]: "elapsed",
  [ProviderMaintenanceStatus.provider_maintenance_status_closed]: "closed"
};
const DISCREPANCY_STATUS_BY_VALUE: Readonly<Partial<Record<number, DiscrepancyView["resolutionStatus"]>>> = {
  [DiscrepancyStatus.discrepancy_status_unspecified]: "unspecified",
  [DiscrepancyStatus.discrepancy_status_pending]: "pending",
  [DiscrepancyStatus.discrepancy_status_resolved]: "resolved",
  [DiscrepancyStatus.discrepancy_status_timed_out]: "timed_out"
};
const DISCREPANCY_REASON_BY_VALUE: Readonly<Partial<Record<number, DiscrepancyView["resolutionReason"]>>> = {
  [DiscrepancyResolutionReason.discrepancy_resolution_reason_unspecified]: "unspecified",
  [DiscrepancyResolutionReason.discrepancy_resolution_reason_auditor_a_correct]: "auditor_a_correct",
  [DiscrepancyResolutionReason.discrepancy_resolution_reason_auditor_b_correct]: "auditor_b_correct",
  [DiscrepancyResolutionReason.discrepancy_resolution_reason_both_auditors_wrong]: "both_auditors_wrong",
  [DiscrepancyResolutionReason.discrepancy_resolution_reason_provider_fault]: "provider_fault",
  [DiscrepancyResolutionReason.discrepancy_resolution_reason_shared_fault]: "shared_fault",
  [DiscrepancyResolutionReason.discrepancy_resolution_reason_evidence_inconclusive]: "evidence_inconclusive",
  [DiscrepancyResolutionReason.discrepancy_resolution_reason_governance_timeout_review]: "governance_timeout_review"
};

export interface ProviderVerificationCurrentRecords {
  attestations: readonly AttestationRecord[];
  bond: ProviderBondWithRequirement | null;
  snapshot: ProviderSnapshotRecord | null;
  grace: ProviderVerificationGraceRecord | null;
  auditEscrows: readonly AuditEscrowRecord[];
  maintenance: readonly ProviderMaintenanceWithStatus[];
  discrepancies: readonly DiscrepancyEvent[];
}

export interface ProviderBondWithRequirement extends ProviderBondRecord {
  requiredForCurrentTier: { denom: string; amount: string };
}

export type ProviderVerificationSupplementalCompleteness = Pick<
  ProviderVerificationViewCompleteness,
  "params" | "bond" | "auditEscrows" | "maintenance" | "discrepancies"
>;

export type ProviderVerificationSummaryCompleteness = Pick<ProviderVerificationViewCompleteness, "params" | "maintenance" | "discrepancies">;

export interface MapProviderVerificationListViewInput {
  provider: string;
  moduleActive: boolean | null;
  facts: ProviderVerificationFacts;
  maintenanceStatuses: readonly ProviderMaintenanceStatus[];
  discrepancyStatuses: readonly DiscrepancyStatus[];
  graceStatus: VerificationGraceStatus | null;
  completeness: ProviderVerificationSummaryCompleteness;
}

export interface MapProviderVerificationViewInput {
  provider: string;
  providerDeclaredTier: string | null;
  moduleActive: boolean | null;
  facts: ProviderVerificationFacts;
  records: ProviderVerificationCurrentRecords;
  completeness: ProviderVerificationSupplementalCompleteness;
}

export function mapProviderVerificationListView(input: MapProviderVerificationListViewInput): ProviderVerificationListView {
  return {
    provider: input.provider,
    moduleActive: input.completeness.params ? input.moduleActive : null,
    summary: mapProviderVerificationSummary(input),
    observedAt: input.facts.observedAt.toISOString(),
    observedHeight: input.facts.observedHeight
  };
}

export function mapProviderVerificationView(input: MapProviderVerificationViewInput): ProviderVerificationView {
  const derivedSummary = deriveProviderVerificationSummary(input.facts);
  const attestations = input.records.attestations
    .filter(record => record.provider === input.provider)
    .sort((left, right) => compareDatesDesc(left.createdAt, right.createdAt) || left.auditor.localeCompare(right.auditor));
  const auditEscrows = input.records.auditEscrows
    .filter(record => record.provider === input.provider)
    .sort((left, right) => compareBigIntsDesc(left.id, right.id));
  const maintenance = input.records.maintenance
    .filter(item => !item.record || item.record.provider === input.provider)
    .sort((left, right) => compareDatesDesc(left.record?.startsAt, right.record?.startsAt));
  const discrepancies = input.records.discrepancies
    .filter(record => record.provider === input.provider)
    .sort((left, right) => compareDatesDesc(left.timestamp, right.timestamp) || compareBigIntsDesc(left.id, right.id));
  const completeness: ProviderVerificationViewCompleteness = {
    params: input.completeness.params,
    attestations: input.facts.completeness.attestations,
    graces: input.facts.completeness.graces,
    snapshot: input.facts.completeness.snapshot,
    bond: input.completeness.bond,
    auditEscrows: input.completeness.auditEscrows,
    maintenance: input.completeness.maintenance,
    discrepancies: input.completeness.discrepancies
  };
  const listSummary = mapProviderVerificationSummary({
    provider: input.provider,
    moduleActive: input.moduleActive,
    facts: input.facts,
    maintenanceStatuses: maintenance.map(item => item.status),
    discrepancyStatuses: discrepancies.map(item => item.resolutionStatus),
    graceStatus: input.records.grace?.status ?? null,
    completeness
  });

  return {
    provider: input.provider,
    providerDeclaredTier: input.providerDeclaredTier,
    moduleActive: completeness.params ? input.moduleActive : null,
    provenance: {
      providerTier: "provider self-declared",
      inventory: "provider-signed inventory",
      attestations: "auditor-attested"
    },
    summary: {
      bestAttestedTier: completeness.attestations ? mapTier(derivedSummary.bestStatusValidTier) : null,
      ...listSummary,
      validAttestationCount: completeness.attestations ? derivedSummary.validAttestationCount : null,
      validAuditors: completeness.attestations ? derivedSummary.validAuditors : null
    },
    attestations: attestations.map(mapAttestation),
    bond: input.records.bond ? mapBond(input.records.bond) : null,
    snapshot: input.records.snapshot ? mapSnapshot(input.records.snapshot) : null,
    grace: input.records.grace ? mapGrace(input.records.grace) : null,
    auditEscrows: auditEscrows.map(mapAuditEscrow),
    maintenance: maintenance.map(mapMaintenance),
    discrepancies: discrepancies.map(mapDiscrepancy),
    observedAt: input.facts.observedAt.toISOString(),
    observedHeight: input.facts.observedHeight,
    completeness
  };
}

function mapProviderVerificationSummary(input: MapProviderVerificationListViewInput): ProviderVerificationListView["summary"] {
  const summary = deriveProviderVerificationSummary(input.facts);

  return {
    effectiveTier: input.facts.completeness.attestations && input.facts.completeness.graces ? mapTier(summary.tierGateTier) : null,
    validAuditorCount: input.facts.completeness.attestations ? summary.validAuditors.length : null,
    capabilities: input.facts.completeness.attestations ? summary.capabilities.map(mapCapability) : null,
    snapshotState: summary.snapshotState,
    maintenanceState: deriveMaintenanceState(input.maintenanceStatuses, input.completeness.maintenance),
    reviewState: deriveReviewState(input.discrepancyStatuses, input.graceStatus, {
      discrepancies: input.completeness.discrepancies,
      graces: input.facts.completeness.graces
    })
  };
}

function mapAttestation(record: AttestationRecord): ProviderVerificationView["attestations"][number] {
  return {
    provider: record.provider,
    auditor: record.auditor,
    tier: mapTier(record.tier),
    capabilities: record.capabilities.map(mapCapability),
    evidenceHash: mapBytes(record.evidenceHash),
    fee: mapCoin(record.fee),
    feeStatus: mapEnum(record.feeStatus, FEE_STATUS_BY_VALUE),
    createdAt: mapDate(record.createdAt),
    expiresAt: mapDate(record.expiresAt),
    status: mapEnum(record.status, ATTESTATION_STATUS_BY_VALUE),
    voidedReason: mapEnum(record.voidedReason, VOIDED_REASON_BY_VALUE),
    deposit: mapCoin(record.deposit),
    depositStatus: mapEnum(record.depositStatus, DEPOSIT_STATUS_BY_VALUE),
    auditEscrowId: record.auditEscrowId.toString(),
    faultAttribution: mapEnum(record.faultAttribution, FAULT_ATTRIBUTION_BY_VALUE)
  };
}

function mapBond(record: ProviderBondWithRequirement): NonNullable<ProviderVerificationView["bond"]> {
  return {
    provider: record.provider,
    bondedAmount: mapCoin(record.bondedAmount),
    requiredForCurrentTier: record.requiredForCurrentTier,
    unbondingEntries: record.unbondingEntries.map(entry => ({
      amount: mapCoin(entry.amount),
      completionTime: mapDate(entry.completionTime)
    })),
    slashed: record.slashed,
    lastSlashTime: mapDate(record.lastSlashTime)
  };
}

function mapSnapshot(record: ProviderSnapshotRecord): NonNullable<ProviderVerificationView["snapshot"]> {
  return {
    provider: record.provider,
    snapshotHash: mapBytes(record.snapshotHash),
    resourceSummary: record.resourceSummary ? mapResourceSummary(record.resourceSummary) : null,
    postedAt: mapDate(record.postedAt),
    snapshotTimestamp: mapDate(record.snapshotTimestamp),
    complianceDeadline: mapDate(record.complianceDeadline),
    suspended: record.suspended
  };
}

function mapResourceSummary(summary: ResourceSummary): NonNullable<NonNullable<ProviderVerificationView["snapshot"]>["resourceSummary"]> {
  return {
    totalGpus: summary.totalGpus,
    totalVcpus: summary.totalVcpus,
    totalMemoryMb: summary.totalMemoryMb.toString(),
    totalStorageMb: summary.totalStorageMb.toString(),
    activeLeases: summary.activeLeases,
    softwareVersion: summary.softwareVersion,
    softwareSignature: mapBytes(summary.softwareSignature),
    softwareIdentity: summary.softwareIdentity ? mapSoftwareIdentity(summary.softwareIdentity) : null
  };
}

function mapSoftwareIdentity(
  identity: SoftwareIdentity
): NonNullable<NonNullable<NonNullable<ProviderVerificationView["snapshot"]>["resourceSummary"]>["softwareIdentity"]> {
  return {
    version: identity.version,
    artifactRef: identity.artifactRef,
    digestAlgorithm: identity.digestAlgorithm,
    digest: mapBytes(identity.digest),
    signatureType: identity.signatureType,
    signature: mapBytes(identity.signature),
    signatureRef: identity.signatureRef,
    publicKeyRef: identity.publicKeyRef
  };
}

function mapAuditEscrow(record: AuditEscrowRecord): ProviderVerificationView["auditEscrows"][number] {
  return {
    id: record.id.toString(),
    provider: record.provider,
    consumedByAuditor: record.consumedByAuditor || null,
    requestedTier: mapTier(record.requestedTier),
    requestedCapabilities: record.requestedCapabilities.map(mapCapability),
    fee: mapCoin(record.fee),
    feeStatus: mapEnum(record.feeStatus, FEE_STATUS_BY_VALUE),
    providerDeposit: mapCoin(record.providerDeposit),
    providerDepositStatus: mapEnum(record.providerDepositStatus, PROVIDER_DEPOSIT_STATUS_BY_VALUE),
    status: mapEnum(record.status, ESCROW_STATUS_BY_VALUE),
    openedAt: mapDate(record.openedAt),
    consumedAt: mapDate(record.consumedAt),
    expiresAt: mapDate(record.expiresAt),
    metadataHash: mapBytes(record.metadataHash),
    settlementReason: mapEnum(record.settlementReason, ESCROW_SETTLEMENT_REASON_BY_VALUE),
    faultAttribution: mapEnum(record.faultAttribution, FAULT_ATTRIBUTION_BY_VALUE)
  };
}

function mapGrace(record: ProviderVerificationGraceRecord): NonNullable<ProviderVerificationView["grace"]> {
  return {
    id: record.id.toString(),
    provider: record.provider,
    preservedTier: mapTier(record.preservedTier),
    sourceDiscrepancyIds: record.sourceDiscrepancyIds.map(id => id.toString()),
    startedAt: mapDate(record.startedAt),
    expiresAt: mapDate(record.expiresAt),
    status: mapEnum(record.status, GRACE_STATUS_BY_VALUE)
  };
}

function mapMaintenance(item: ProviderMaintenanceWithStatus): ProviderVerificationView["maintenance"][number] {
  return {
    record: item.record ? mapMaintenanceRecord(item.record) : null,
    status: mapEnum(item.status, MAINTENANCE_STATUS_BY_VALUE)
  };
}

function mapMaintenanceRecord(record: ProviderMaintenanceRecord): NonNullable<ProviderVerificationView["maintenance"][number]["record"]> {
  return {
    id: record.id.toString(),
    provider: record.provider,
    maintenanceType: mapEnum(record.maintenanceType, MAINTENANCE_TYPE_BY_VALUE),
    startsAt: mapDate(record.startsAt),
    expectedEndsAt: mapDate(record.expectedEndsAt),
    openedAt: mapDate(record.openedAt),
    closedAt: mapDate(record.closedAt),
    metadataHash: mapBytes(record.metadataHash)
  };
}

function mapDiscrepancy(record: DiscrepancyEvent): ProviderVerificationView["discrepancies"][number] {
  return {
    id: record.id.toString(),
    provider: record.provider,
    auditorA: record.auditorA,
    auditorATier: mapTier(record.auditorATier),
    auditorB: record.auditorB,
    auditorBTier: mapTier(record.auditorBTier),
    timestamp: mapDate(record.timestamp),
    resolutionStatus: mapEnum(record.resolutionStatus, DISCREPANCY_STATUS_BY_VALUE),
    resolutionProposalId: record.resolutionProposalId.toString(),
    graceRecordId: record.graceRecordId.toString(),
    resolutionReason: mapEnum(record.resolutionReason, DISCREPANCY_REASON_BY_VALUE),
    faultAttribution: mapEnum(record.faultAttribution, FAULT_ATTRIBUTION_BY_VALUE),
    resolutionEvidenceHash: mapBytes(record.resolutionEvidenceHash)
  };
}

function deriveMaintenanceState(
  maintenanceStatuses: readonly ProviderMaintenanceStatus[],
  complete: boolean
): ProviderVerificationListView["summary"]["maintenanceState"] {
  if (!complete) return "unknown";
  if (maintenanceStatuses.includes(ProviderMaintenanceStatus.provider_maintenance_status_active)) return "active";
  if (maintenanceStatuses.includes(ProviderMaintenanceStatus.provider_maintenance_status_scheduled)) return "scheduled";
  if (
    maintenanceStatuses.some(
      status => status === ProviderMaintenanceStatus.provider_maintenance_status_unspecified || status === ProviderMaintenanceStatus.UNRECOGNIZED
    )
  ) {
    return "unknown";
  }
  return "none";
}

function deriveReviewState(
  discrepancyStatuses: readonly DiscrepancyStatus[],
  graceStatus: VerificationGraceStatus | null,
  completeness: Pick<ProviderVerificationViewCompleteness, "discrepancies" | "graces">
): ProviderVerificationListView["summary"]["reviewState"] {
  if (!completeness.discrepancies) return "unknown";
  if (discrepancyStatuses.includes(DiscrepancyStatus.discrepancy_status_pending)) return "under_review";
  if (!completeness.graces) return "unknown";
  if (graceStatus === VerificationGraceStatus.verification_grace_status_active) return "grace";
  return "none";
}

export function mapTier(tier: VerificationTier): ProviderVerificationTier {
  switch (tier) {
    case VerificationTier.verification_tier_unspecified:
      return "L0";
    case VerificationTier.verification_tier_identified:
      return "L1";
    case VerificationTier.verification_tier_verified:
      return "L2";
    case VerificationTier.verification_tier_established:
      return "L3";
    case VerificationTier.verification_tier_trusted:
      return "L4";
    default:
      return "unknown";
  }
}

function mapCapability(capability: CapabilityFlag): ProviderVerificationCapability {
  return mapEnum(capability, CAPABILITY_BY_VALUE);
}

function mapEnum<TValue extends string>(value: number, values: Readonly<Partial<Record<number, TValue>>>): TValue | "unknown" {
  return values[value] ?? "unknown";
}

function mapCoin(coin: { denom: string; amount: string } | undefined): { denom: string; amount: string } | null {
  return coin ? { denom: coin.denom, amount: coin.amount } : null;
}

function mapDate(value: Date | undefined): string | null {
  return value?.toISOString() ?? null;
}

function mapBytes(value: Uint8Array): string | null {
  return value.length > 0 ? Buffer.from(value).toString("base64") : null;
}

function compareDatesDesc(left: Date | undefined, right: Date | undefined): number {
  return (right?.getTime() ?? 0) - (left?.getTime() ?? 0);
}

function compareBigIntsDesc(left: bigint, right: bigint): number {
  return left === right ? 0 : left > right ? -1 : 1;
}
