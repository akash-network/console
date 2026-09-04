import { Verification_Params } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import {
  deriveProviderTierState,
  type ProviderTierState,
  type ProviderVerificationGlobalState,
  type ProviderVerificationProviderState
} from "@akashnetwork/provider-verification";

interface Observation {
  observedHeight: number;
  observedBlockTime: Date;
}

export interface ProviderVerificationGlobalRows {
  observedHeight: number;
  params: (Observation & { id: number; params: Record<string, unknown> }) | null;
  auditors: Array<
    Observation & {
      address: string;
      status: number;
      maxAttestationTier: number;
      bondDenom: string;
      bondAmount: string;
      bondStatus: number;
      metadataHash: Buffer | null;
      registeredAt: Date;
      renewalDeadline: Date;
      discrepancyCount: string;
      bondUnbondingCompletionTime: Date | null;
    }
  >;
  discrepancies: Array<
    Observation & {
      id: string;
      provider: string;
      auditorA: string;
      auditorATier: number;
      auditorB: string;
      auditorBTier: number;
      detectedAt: Date;
      resolutionStatus: number;
      resolutionProposalId: string;
      graceRecordId: string;
      resolutionReason: number;
      faultAttribution: number;
      resolutionEvidenceHash: Buffer | null;
    }
  >;
}

export interface ProviderVerificationProviderRows {
  provider: string;
  observedHeight: number;
  observedBlockTime: Date;
  tierState: ProviderTierState;
  attestations: Array<
    Observation & {
      provider: string;
      auditor: string;
      tier: number;
      evidenceHash: Buffer;
      feeDenom: string;
      feeAmount: string;
      feeStatus: number;
      createdAt: Date;
      expiresAt: Date;
      status: number;
      voidedReason: number;
      depositDenom: string;
      depositAmount: string;
      depositStatus: number;
      auditEscrowId: string;
      faultAttribution: number;
    }
  >;
  attestationCapabilities: Array<Observation & { provider: string; auditor: string; capability: number }>;
  auditEscrows: Array<
    Observation & {
      id: string;
      provider: string;
      consumedByAuditor: string;
      requestedTier: number;
      feeDenom: string;
      feeAmount: string;
      feeStatus: number;
      providerDepositDenom: string;
      providerDepositAmount: string;
      providerDepositStatus: number;
      status: number;
      openedAt: Date;
      consumedAt: Date | null;
      expiresAt: Date;
      metadataHash: Buffer | null;
      settlementReason: number;
      faultAttribution: number;
    }
  >;
  auditEscrowCapabilities: Array<Observation & { auditEscrowId: string; capability: number }>;
  bond:
    | (Observation & {
        provider: string;
        bondedDenom: string;
        bondedAmount: string;
        requiredForCurrentTierDenom: string;
        requiredForCurrentTierAmount: string;
        slashed: boolean;
        lastSlashTime: Date | null;
      })
    | null;
  bondUnbondingEntries: Array<Observation & { provider: string; entryIndex: number; denom: string; amount: string; completionTime: Date }>;
  grace:
    | (Observation & {
        id: string;
        provider: string;
        preservedTier: number;
        startedAt: Date;
        expiresAt: Date;
        status: number;
      })
    | null;
  graceDiscrepancies: Array<Observation & { graceId: string; discrepancyId: string }>;
  maintenances: Array<
    Observation & {
      provider: string;
      id: string;
      maintenanceType: number;
      startsAt: Date;
      expectedEndsAt: Date;
      openedAt: Date;
      closedAt: Date | null;
      metadataHash: Buffer | null;
      status: number;
    }
  >;
  snapshot:
    | (Observation & {
        provider: string;
        snapshotHash: Buffer;
        totalGpus: number;
        totalVcpus: number;
        totalMemoryMb: string;
        totalStorageMb: string;
        activeLeases: number;
        softwareVersion: string;
        softwareSignature: Buffer | null;
        softwareIdentityVersion: string | null;
        softwareArtifactRef: string | null;
        softwareDigestAlgorithm: string | null;
        softwareDigest: Buffer | null;
        softwareSignatureType: string | null;
        softwareIdentitySignature: Buffer | null;
        softwareSignatureRef: string | null;
        softwarePublicKeyRef: string | null;
        postedAt: Date;
        snapshotTimestamp: Date;
        complianceDeadline: Date;
        suspended: boolean;
      })
    | null;
}

export function mapProviderVerificationGlobalState(state: ProviderVerificationGlobalState, observedBlockTime: Date): ProviderVerificationGlobalRows {
  const observation = createObservation(state.observedHeight, observedBlockTime);

  return {
    observedHeight: observation.observedHeight,
    params: state.params
      ? {
          id: 1,
          params: serializeVerificationParams(state.params),
          ...observation
        }
      : null,
    auditors: state.auditors.map(auditor => ({
      address: auditor.address,
      status: auditor.status,
      maxAttestationTier: auditor.maxAttestationTier,
      bondDenom: auditor.bondAmount?.denom ?? "",
      bondAmount: auditor.bondAmount?.amount ?? "0",
      bondStatus: auditor.bondStatus,
      metadataHash: optionalBuffer(auditor.metadataHash),
      registeredAt: requiredDate(auditor.registeredAt, "auditor.registeredAt"),
      renewalDeadline: requiredDate(auditor.renewalDeadline, "auditor.renewalDeadline"),
      discrepancyCount: auditor.discrepancyCount.toString(),
      bondUnbondingCompletionTime: auditor.bondUnbondingCompletionTime ?? null,
      ...observation
    })),
    discrepancies: state.discrepancies.map(discrepancy => ({
      id: discrepancy.id.toString(),
      provider: discrepancy.provider,
      auditorA: discrepancy.auditorA,
      auditorATier: discrepancy.auditorATier,
      auditorB: discrepancy.auditorB,
      auditorBTier: discrepancy.auditorBTier,
      detectedAt: requiredDate(discrepancy.timestamp, "discrepancy.timestamp"),
      resolutionStatus: discrepancy.resolutionStatus,
      resolutionProposalId: discrepancy.resolutionProposalId.toString(),
      graceRecordId: discrepancy.graceRecordId.toString(),
      resolutionReason: discrepancy.resolutionReason,
      faultAttribution: discrepancy.faultAttribution,
      resolutionEvidenceHash: optionalBuffer(discrepancy.resolutionEvidenceHash),
      ...observation
    }))
  };
}

export function mapProviderVerificationProviderState(state: ProviderVerificationProviderState, observedBlockTime: Date): ProviderVerificationProviderRows {
  const observation = createObservation(state.observedHeight, observedBlockTime);
  const tierState = deriveProviderTierState({
    attestations: state.attestations,
    graces: state.grace ? [state.grace] : [],
    snapshot: state.snapshot,
    completeness: { attestations: true, graces: true, snapshot: true },
    observedAt: observedBlockTime,
    observedHeight: state.observedHeight
  });
  const attestations = state.attestations.map(attestation => ({
    provider: attestation.provider,
    auditor: attestation.auditor,
    tier: attestation.tier,
    evidenceHash: Buffer.from(attestation.evidenceHash),
    feeDenom: attestation.fee?.denom ?? "",
    feeAmount: attestation.fee?.amount ?? "0",
    feeStatus: attestation.feeStatus,
    createdAt: requiredDate(attestation.createdAt, "attestation.createdAt"),
    expiresAt: requiredDate(attestation.expiresAt, "attestation.expiresAt"),
    status: attestation.status,
    voidedReason: attestation.voidedReason,
    depositDenom: attestation.deposit?.denom ?? "",
    depositAmount: attestation.deposit?.amount ?? "0",
    depositStatus: attestation.depositStatus,
    auditEscrowId: attestation.auditEscrowId.toString(),
    faultAttribution: attestation.faultAttribution,
    ...observation
  }));
  const auditEscrows = state.auditEscrows.map(escrow => ({
    id: escrow.id.toString(),
    provider: escrow.provider,
    consumedByAuditor: escrow.consumedByAuditor,
    requestedTier: escrow.requestedTier,
    feeDenom: escrow.fee?.denom ?? "",
    feeAmount: escrow.fee?.amount ?? "0",
    feeStatus: escrow.feeStatus,
    providerDepositDenom: escrow.providerDeposit?.denom ?? "",
    providerDepositAmount: escrow.providerDeposit?.amount ?? "0",
    providerDepositStatus: escrow.providerDepositStatus,
    status: escrow.status,
    openedAt: requiredDate(escrow.openedAt, "auditEscrow.openedAt"),
    consumedAt: escrow.consumedAt ?? null,
    expiresAt: requiredDate(escrow.expiresAt, "auditEscrow.expiresAt"),
    metadataHash: optionalBuffer(escrow.metadataHash),
    settlementReason: escrow.settlementReason,
    faultAttribution: escrow.faultAttribution,
    ...observation
  }));
  const grace = state.grace
    ? {
        id: state.grace.id.toString(),
        provider: state.grace.provider,
        preservedTier: state.grace.preservedTier,
        startedAt: requiredDate(state.grace.startedAt, "grace.startedAt"),
        expiresAt: requiredDate(state.grace.expiresAt, "grace.expiresAt"),
        status: state.grace.status,
        ...observation
      }
    : null;
  const requiredBond = state.bond ? requiredCoin(state.requiredBondForCurrentTier, "requiredBondForCurrentTier") : null;
  const bond = state.bond
    ? {
        provider: state.bond.provider,
        bondedDenom: state.bond.bondedAmount?.denom ?? "",
        bondedAmount: state.bond.bondedAmount?.amount ?? "0",
        requiredForCurrentTierDenom: requiredBond!.denom,
        requiredForCurrentTierAmount: requiredBond!.amount,
        slashed: state.bond.slashed,
        lastSlashTime: state.bond.lastSlashTime ?? null,
        ...observation
      }
    : null;
  const snapshot = mapSnapshot(state, observation);

  return {
    provider: state.provider,
    observedHeight: observation.observedHeight,
    observedBlockTime: observation.observedBlockTime,
    tierState,
    attestations,
    attestationCapabilities: state.attestations.flatMap(attestation =>
      attestation.capabilities.map(capability => ({
        provider: attestation.provider,
        auditor: attestation.auditor,
        capability,
        ...observation
      }))
    ),
    auditEscrows,
    auditEscrowCapabilities: state.auditEscrows.flatMap(escrow =>
      escrow.requestedCapabilities.map(capability => ({ auditEscrowId: escrow.id.toString(), capability, ...observation }))
    ),
    bond,
    bondUnbondingEntries:
      state.bond?.unbondingEntries.map((entry, entryIndex) => ({
        provider: state.bond!.provider,
        entryIndex,
        denom: entry.amount?.denom ?? "",
        amount: entry.amount?.amount ?? "0",
        completionTime: requiredDate(entry.completionTime, "bond.unbondingEntry.completionTime"),
        ...observation
      })) ?? [],
    grace,
    graceDiscrepancies:
      state.grace?.sourceDiscrepancyIds.map(discrepancyId => ({
        graceId: state.grace!.id.toString(),
        discrepancyId: discrepancyId.toString(),
        ...observation
      })) ?? [],
    maintenances: state.maintenances.map(maintenance => {
      const record = maintenance.record;
      if (!record) throw new Error("Invalid provider verification response: maintenance.record is missing");

      return {
        provider: record.provider,
        id: record.id.toString(),
        maintenanceType: record.maintenanceType,
        startsAt: requiredDate(record.startsAt, "maintenance.startsAt"),
        expectedEndsAt: requiredDate(record.expectedEndsAt, "maintenance.expectedEndsAt"),
        openedAt: requiredDate(record.openedAt, "maintenance.openedAt"),
        closedAt: record.closedAt ?? null,
        metadataHash: optionalBuffer(record.metadataHash),
        status: maintenance.status,
        ...observation
      };
    }),
    snapshot
  };
}

function mapSnapshot(state: ProviderVerificationProviderState, observation: Observation): ProviderVerificationProviderRows["snapshot"] {
  if (!state.snapshot) return null;
  const summary = state.snapshot.resourceSummary;
  if (!summary) throw new Error("Invalid provider verification response: snapshot.resourceSummary is missing");
  const identity = summary.softwareIdentity;

  return {
    provider: state.snapshot.provider,
    snapshotHash: Buffer.from(state.snapshot.snapshotHash),
    totalGpus: summary.totalGpus,
    totalVcpus: summary.totalVcpus,
    totalMemoryMb: summary.totalMemoryMb.toString(),
    totalStorageMb: summary.totalStorageMb.toString(),
    activeLeases: summary.activeLeases,
    softwareVersion: summary.softwareVersion,
    softwareSignature: optionalBuffer(summary.softwareSignature),
    softwareIdentityVersion: identity?.version || null,
    softwareArtifactRef: identity?.artifactRef || null,
    softwareDigestAlgorithm: identity?.digestAlgorithm || null,
    softwareDigest: optionalBuffer(identity?.digest),
    softwareSignatureType: identity?.signatureType || null,
    softwareIdentitySignature: optionalBuffer(identity?.signature),
    softwareSignatureRef: identity?.signatureRef || null,
    softwarePublicKeyRef: identity?.publicKeyRef || null,
    postedAt: requiredDate(state.snapshot.postedAt, "snapshot.postedAt"),
    snapshotTimestamp: requiredDate(state.snapshot.snapshotTimestamp, "snapshot.snapshotTimestamp"),
    complianceDeadline: requiredDate(state.snapshot.complianceDeadline, "snapshot.complianceDeadline"),
    suspended: state.snapshot.suspended,
    ...observation
  };
}

function createObservation(height: string, observedBlockTime: Date): Observation {
  const observedHeight = Number(height);
  if (!Number.isSafeInteger(observedHeight) || observedHeight < 0) {
    throw new Error(`Invalid provider verification observation height: ${height}`);
  }
  if (Number.isNaN(observedBlockTime.getTime())) {
    throw new Error("Invalid provider verification observation block time");
  }

  return { observedHeight, observedBlockTime };
}

function serializeVerificationParams(params: Verification_Params): Record<string, unknown> {
  return {
    ...(Verification_Params.toJSON(params) as Record<string, unknown>),
    verification_module_active: params.verificationModuleActive
  };
}

function requiredDate(value: Date | undefined, field: string): Date {
  if (!value || Number.isNaN(value.getTime())) {
    throw new Error(`Invalid provider verification response: ${field} is missing`);
  }
  return value;
}

function optionalBuffer(value: Uint8Array | undefined): Buffer | null {
  return value?.length ? Buffer.from(value) : null;
}

function requiredCoin(value: { denom: string; amount: string } | null, field: string): { denom: string; amount: string } {
  if (!value) throw new Error(`Invalid provider verification response: ${field} is missing`);
  return value;
}
