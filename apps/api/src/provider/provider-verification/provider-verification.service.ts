import type {
  AttestationRecord,
  AuditEscrowRecord,
  DiscrepancyEvent,
  ProviderSnapshotRecord,
  ProviderVerificationGraceRecord,
  SoftwareIdentity
} from "@akashnetwork/chain-sdk/private-types/akash.v1";
import type { ProviderMaintenanceWithStatus } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import type {
  ProviderMaintenance,
  VerificationAttestation,
  VerificationAuditEscrow,
  VerificationDiscrepancy,
  VerificationGrace,
  VerificationProviderBond,
  VerificationProviderSnapshot
} from "@akashnetwork/database/dbSchemas/akash";
import type { ProviderVerificationFacts } from "@akashnetwork/provider-verification";
import { singleton } from "tsyringe";

import { mapProviderVerificationListView, mapProviderVerificationView, type ProviderBondWithRequirement } from "./provider-verification.mapper";
import {
  type ProviderVerificationIndexedRows,
  ProviderVerificationRepository,
  type ProviderVerificationSummaryIndexedRows
} from "./provider-verification.repository";
import type { ProviderVerificationListView, ProviderVerificationView } from "./provider-verification.schema";

export interface ProviderVerificationSubject {
  provider: string;
  providerDeclaredTier: string | null;
}

@singleton()
export class ProviderVerificationService {
  constructor(private readonly repository: ProviderVerificationRepository) {}

  async getSummaries(providers: readonly string[]): Promise<Map<string, ProviderVerificationListView | null>> {
    const distinctProviders = [...new Set(providers)];
    if (distinctProviders.length === 0) return new Map();

    const rows = await this.repository.getSummaryState(distinctProviders);
    const moduleActive = readModuleActive(rows.params?.params);

    if (moduleActive === null) {
      return new Map(distinctProviders.map(provider => [provider, null]));
    }

    const completeness = getCompleteness(rows);
    const index = indexSummaryRows(rows);

    return new Map(
      distinctProviders.map(provider => {
        const observation = index.observationByProvider.get(provider);
        const complete = !!observation && !completeness.globalIncomplete && !completeness.pendingProviders.has(provider);
        const facts = toSummaryFacts(index, provider, complete, observation?.observedBlockTime ?? new Date(0), String(observation?.observedHeight ?? 0));
        const grace = index.gracesByProvider.get(provider)?.[0];

        return [
          provider,
          mapProviderVerificationListView({
            provider,
            moduleActive,
            facts,
            maintenanceStatuses: index.maintenancesByProvider.get(provider)?.map(item => item.status) ?? [],
            discrepancyStatuses: index.discrepanciesByProvider.get(provider)?.map(item => item.resolutionStatus) ?? [],
            graceStatus: grace?.status ?? null,
            completeness: {
              params: !completeness.paramsIncomplete,
              maintenance: complete,
              discrepancies: complete
            }
          })
        ];
      })
    );
  }

  async getViews(subjects: readonly ProviderVerificationSubject[]): Promise<Map<string, ProviderVerificationView | null>> {
    const providers = [...new Set(subjects.map(subject => subject.provider))];
    if (providers.length === 0) return new Map();

    const rows = await this.repository.getCurrentState(providers);
    const moduleActive = readModuleActive(rows.params?.params);

    if (moduleActive === null) {
      return new Map(providers.map(provider => [provider, null]));
    }

    const declaredTierByProvider = new Map(subjects.map(subject => [subject.provider, subject.providerDeclaredTier]));
    const completeness = getCompleteness(rows);

    return new Map(
      providers.map(provider => {
        const observation = rows.providerObservations.find(item => item.provider === provider);
        const complete = !!observation && !completeness.globalIncomplete && !completeness.pendingProviders.has(provider);
        const records = toCurrentRecords(rows, provider);
        const facts = toFacts(rows, provider, records, complete, observation?.observedBlockTime ?? new Date(0), String(observation?.observedHeight ?? 0));

        return [
          provider,
          mapProviderVerificationView({
            provider,
            providerDeclaredTier: declaredTierByProvider.get(provider) ?? null,
            moduleActive,
            facts,
            records,
            completeness: {
              params: !completeness.paramsIncomplete,
              bond: complete,
              auditEscrows: complete,
              maintenance: complete,
              discrepancies: complete
            }
          })
        ];
      })
    );
  }
}

interface ProviderVerificationSummaryIndex {
  observationByProvider: Map<string, ProviderVerificationSummaryIndexedRows["providerObservations"][number]>;
  attestationsByProvider: Map<string, ProviderVerificationSummaryIndexedRows["attestations"]>;
  capabilitiesByProviderAndAuditor: Map<string, Map<string, number[]>>;
  gracesByProvider: Map<string, ProviderVerificationSummaryIndexedRows["graces"]>;
  maintenancesByProvider: Map<string, ProviderVerificationSummaryIndexedRows["maintenances"]>;
  snapshotByProvider: Map<string, ProviderVerificationSummaryIndexedRows["snapshots"][number]>;
  discrepanciesByProvider: Map<string, ProviderVerificationSummaryIndexedRows["discrepancies"]>;
}

function indexSummaryRows(rows: ProviderVerificationSummaryIndexedRows): ProviderVerificationSummaryIndex {
  const gracesByProvider = groupByProvider(rows.graces);
  for (const graces of gracesByProvider.values()) graces.sort(compareObservedDesc);

  const capabilitiesByProviderAndAuditor = new Map<string, Map<string, number[]>>();
  for (const capability of rows.attestationCapabilities) {
    const capabilitiesByAuditor = capabilitiesByProviderAndAuditor.get(capability.provider) ?? new Map<string, number[]>();
    const capabilities = capabilitiesByAuditor.get(capability.auditor) ?? [];
    capabilities.push(capability.capability);
    capabilitiesByAuditor.set(capability.auditor, capabilities);
    capabilitiesByProviderAndAuditor.set(capability.provider, capabilitiesByAuditor);
  }

  return {
    observationByProvider: new Map(rows.providerObservations.map(item => [item.provider, item])),
    attestationsByProvider: groupByProvider(rows.attestations),
    capabilitiesByProviderAndAuditor,
    gracesByProvider,
    maintenancesByProvider: groupByProvider(rows.maintenances),
    snapshotByProvider: new Map(rows.snapshots.map(item => [item.provider, item])),
    discrepanciesByProvider: groupByProvider(rows.discrepancies)
  };
}

function toSummaryFacts(
  index: ProviderVerificationSummaryIndex,
  provider: string,
  complete: boolean,
  observedAt: Date,
  observedHeight: string
): ProviderVerificationFacts {
  const capabilitiesByAuditor = index.capabilitiesByProviderAndAuditor.get(provider);
  const attestations = (index.attestationsByProvider.get(provider) ?? []).map(attestation => ({
    auditor: attestation.auditor,
    capabilities: capabilitiesByAuditor?.get(attestation.auditor) ?? [],
    status: attestation.status,
    tier: attestation.tier
  }));
  const snapshot = index.snapshotByProvider.get(provider);

  return {
    attestations,
    graces: (index.gracesByProvider.get(provider) ?? []).map(grace => ({ preservedTier: grace.preservedTier, status: grace.status })),
    snapshot: snapshot ? { complianceDeadline: snapshot.complianceDeadline, suspended: snapshot.suspended } : null,
    completeness: { attestations: complete, graces: complete, snapshot: complete },
    observedAt,
    observedHeight
  };
}

function groupByProvider<T extends { provider: string }>(records: readonly T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const record of records) {
    const providerRecords = grouped.get(record.provider) ?? [];
    providerRecords.push(record);
    grouped.set(record.provider, providerRecords);
  }
  return grouped;
}

function toFacts(
  rows: ProviderVerificationIndexedRows,
  provider: string,
  records: ReturnType<typeof toCurrentRecords>,
  complete: boolean,
  observedAt: Date,
  observedHeight: string
): ProviderVerificationFacts {
  return {
    attestations: records.attestations,
    graces: rows.graces.filter(grace => grace.provider === provider).map(grace => toGrace(grace, rows)),
    snapshot: records.snapshot,
    completeness: { attestations: complete, graces: complete, snapshot: complete },
    observedAt,
    observedHeight
  };
}

function toCurrentRecords(rows: ProviderVerificationIndexedRows, provider: string) {
  const graces = rows.graces.filter(grace => grace.provider === provider).sort(compareObservedDesc);

  return {
    attestations: rows.attestations.filter(attestation => attestation.provider === provider).map(attestation => toAttestation(attestation, rows)),
    bond: optionalOne(rows.bonds, provider, record => toBond(record, rows)),
    snapshot: optionalOne(rows.snapshots, provider, toSnapshot),
    grace: graces[0] ? toGrace(graces[0], rows) : null,
    auditEscrows: rows.auditEscrows.filter(escrow => escrow.provider === provider).map(escrow => toAuditEscrow(escrow, rows)),
    maintenance: rows.maintenances.filter(maintenance => maintenance.provider === provider).map(toMaintenance),
    discrepancies: rows.discrepancies.filter(discrepancy => discrepancy.provider === provider).map(toDiscrepancy)
  };
}

function toAttestation(record: VerificationAttestation, rows: ProviderVerificationIndexedRows): AttestationRecord {
  return {
    provider: record.provider,
    auditor: record.auditor,
    tier: record.tier,
    capabilities: rows.attestationCapabilities
      .filter(capability => capability.provider === record.provider && capability.auditor === record.auditor)
      .map(capability => capability.capability),
    evidenceHash: toBytes(record.evidenceHash),
    fee: toCoin(record.feeDenom, record.feeAmount),
    feeStatus: record.feeStatus,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    status: record.status,
    voidedReason: record.voidedReason,
    deposit: toCoin(record.depositDenom, record.depositAmount),
    depositStatus: record.depositStatus,
    auditEscrowId: BigInt(record.auditEscrowId),
    faultAttribution: record.faultAttribution
  };
}

function toBond(record: VerificationProviderBond, rows: ProviderVerificationIndexedRows): ProviderBondWithRequirement {
  return {
    provider: record.provider,
    bondedAmount: toCoin(record.bondedDenom, record.bondedAmount),
    requiredForCurrentTier: { denom: record.requiredForCurrentTierDenom, amount: record.requiredForCurrentTierAmount },
    unbondingEntries: rows.bondUnbondingEntries
      .filter(entry => entry.provider === record.provider)
      .sort((left, right) => left.entryIndex - right.entryIndex)
      .map(entry => ({ amount: toCoin(entry.denom, entry.amount), completionTime: entry.completionTime })),
    slashed: record.slashed,
    lastSlashTime: record.lastSlashTime
  };
}

function toSnapshot(record: VerificationProviderSnapshot): ProviderSnapshotRecord {
  return {
    provider: record.provider,
    snapshotHash: toBytes(record.snapshotHash),
    resourceSummary: {
      totalGpus: record.totalGpus,
      totalVcpus: record.totalVcpus,
      totalMemoryMb: BigInt(record.totalMemoryMb),
      totalStorageMb: BigInt(record.totalStorageMb),
      activeLeases: record.activeLeases,
      softwareVersion: record.softwareVersion,
      softwareSignature: toBytes(record.softwareSignature),
      softwareIdentity: toSoftwareIdentity(record)
    },
    postedAt: record.postedAt,
    snapshotTimestamp: record.snapshotTimestamp,
    complianceDeadline: record.complianceDeadline,
    suspended: record.suspended
  };
}

function toSoftwareIdentity(record: VerificationProviderSnapshot): SoftwareIdentity | undefined {
  if (
    !record.softwareIdentityVersion &&
    !record.softwareArtifactRef &&
    !record.softwareDigestAlgorithm &&
    !record.softwareDigest &&
    !record.softwareSignatureType &&
    !record.softwareIdentitySignature &&
    !record.softwareSignatureRef &&
    !record.softwarePublicKeyRef
  ) {
    return undefined;
  }

  return {
    version: record.softwareIdentityVersion ?? "",
    artifactRef: record.softwareArtifactRef ?? "",
    digestAlgorithm: record.softwareDigestAlgorithm ?? "",
    digest: toBytes(record.softwareDigest),
    signatureType: record.softwareSignatureType ?? "",
    signature: toBytes(record.softwareIdentitySignature),
    signatureRef: record.softwareSignatureRef ?? "",
    publicKeyRef: record.softwarePublicKeyRef ?? ""
  };
}

function toGrace(record: VerificationGrace, rows: ProviderVerificationIndexedRows): ProviderVerificationGraceRecord {
  return {
    id: BigInt(record.id),
    provider: record.provider,
    preservedTier: record.preservedTier,
    sourceDiscrepancyIds: rows.graceDiscrepancies.filter(source => source.graceId === record.id).map(source => BigInt(source.discrepancyId)),
    startedAt: record.startedAt,
    expiresAt: record.expiresAt,
    status: record.status
  };
}

function toAuditEscrow(record: VerificationAuditEscrow, rows: ProviderVerificationIndexedRows): AuditEscrowRecord {
  return {
    id: BigInt(record.id),
    provider: record.provider,
    consumedByAuditor: record.consumedByAuditor,
    requestedTier: record.requestedTier,
    requestedCapabilities: rows.auditEscrowCapabilities.filter(capability => capability.auditEscrowId === record.id).map(capability => capability.capability),
    fee: toCoin(record.feeDenom, record.feeAmount),
    feeStatus: record.feeStatus,
    providerDeposit: toCoin(record.providerDepositDenom, record.providerDepositAmount),
    providerDepositStatus: record.providerDepositStatus,
    status: record.status,
    openedAt: record.openedAt,
    consumedAt: record.consumedAt,
    expiresAt: record.expiresAt,
    metadataHash: toBytes(record.metadataHash),
    settlementReason: record.settlementReason,
    faultAttribution: record.faultAttribution
  };
}

function toMaintenance(record: ProviderMaintenance): ProviderMaintenanceWithStatus {
  return {
    record: {
      id: BigInt(record.id),
      provider: record.provider,
      maintenanceType: record.maintenanceType,
      startsAt: record.startsAt,
      expectedEndsAt: record.expectedEndsAt,
      openedAt: record.openedAt,
      closedAt: record.closedAt,
      metadataHash: toBytes(record.metadataHash)
    },
    status: record.status
  };
}

function toDiscrepancy(record: VerificationDiscrepancy): DiscrepancyEvent {
  return {
    id: BigInt(record.id),
    provider: record.provider,
    auditorA: record.auditorA,
    auditorATier: record.auditorATier,
    auditorB: record.auditorB,
    auditorBTier: record.auditorBTier,
    timestamp: record.detectedAt,
    resolutionStatus: record.resolutionStatus,
    resolutionProposalId: BigInt(record.resolutionProposalId),
    graceRecordId: BigInt(record.graceRecordId),
    resolutionReason: record.resolutionReason,
    faultAttribution: record.faultAttribution,
    resolutionEvidenceHash: toBytes(record.resolutionEvidenceHash)
  };
}

function readModuleActive(params: Record<string, unknown> | undefined): boolean | null {
  const value = params?.verification_module_active;
  return typeof value === "boolean" ? value : null;
}

function getCompleteness(rows: ProviderVerificationSummaryIndexedRows) {
  return {
    paramsIncomplete: rows.hasUnprocessedBlockEvents || rows.pendingTargets.some(target => target.targetType === "global" && target.invalidated),
    globalIncomplete: rows.hasUnprocessedBlockEvents || rows.pendingTargets.some(target => target.targetType !== "provider"),
    pendingProviders: new Set(rows.pendingTargets.filter(target => target.targetType === "provider").map(target => target.targetKey))
  };
}

function optionalOne<T extends { provider: string }, R>(records: T[], provider: string, map: (record: T) => R): R | null {
  const record = records.find(item => item.provider === provider);
  return record ? map(record) : null;
}

function toCoin(denom: string, amount: string): { denom: string; amount: string } | undefined {
  return denom || amount !== "0" ? { denom, amount } : undefined;
}

function toBytes(value: Uint8Array | null | undefined): Uint8Array {
  return value ? Uint8Array.from(value) : new Uint8Array();
}

function compareObservedDesc(left: { observedHeight: number }, right: { observedHeight: number }): number {
  return right.observedHeight - left.observedHeight;
}
