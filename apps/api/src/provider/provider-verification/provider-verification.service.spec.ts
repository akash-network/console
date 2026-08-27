import {
  AttestationStatus,
  CapabilityFlag,
  DiscrepancyStatus,
  VerificationGraceStatus,
  VerificationTier
} from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { ProviderMaintenanceStatus } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import type {
  ProviderMaintenance,
  VerificationAttestation,
  VerificationAttestationCapability,
  VerificationDiscrepancy,
  VerificationGrace,
  VerificationParams,
  VerificationProviderObservation,
  VerificationProviderSnapshot,
  VerificationReconcileTarget
} from "@akashnetwork/database/dbSchemas/akash";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ProviderVerificationRepository } from "./provider-verification.repository";
import { type ProviderVerificationIndexedRows, type ProviderVerificationSummaryIndexedRows } from "./provider-verification.repository";
import { ProviderVerificationListViewSchema, ProviderVerificationViewSchema } from "./provider-verification.schema";
import { ProviderVerificationService } from "./provider-verification.service";

const PROVIDER = "akash1provider";

describe(ProviderVerificationService.name, () => {
  beforeEach(() => vi.useFakeTimers({ now: new Date("2026-08-24T12:00:00.000Z") }));
  afterEach(() => vi.useRealTimers());

  it("maps a batch list summary without loading detail state", async () => {
    const { service, repository } = setup();
    repository.getSummaryState.mockResolvedValue(
      summaryRows({
        attestations: [
          row<VerificationAttestation>({
            provider: PROVIDER,
            auditor: "akash1auditor",
            tier: VerificationTier.verification_tier_verified,
            status: AttestationStatus.attestation_status_valid
          })
        ],
        attestationCapabilities: [
          row<VerificationAttestationCapability>({
            provider: PROVIDER,
            auditor: "akash1auditor",
            capability: CapabilityFlag.capability_persistent_storage
          })
        ],
        graces: [
          row<VerificationGrace>({
            provider: PROVIDER,
            preservedTier: VerificationTier.verification_tier_established,
            status: VerificationGraceStatus.verification_grace_status_active,
            observedHeight: 125
          })
        ],
        maintenances: [row<ProviderMaintenance>({ provider: PROVIDER, status: ProviderMaintenanceStatus.provider_maintenance_status_scheduled })],
        snapshots: [
          row<VerificationProviderSnapshot>({
            provider: PROVIDER,
            complianceDeadline: new Date("2026-08-25T12:00:00.000Z"),
            suspended: false
          })
        ],
        discrepancies: [row<VerificationDiscrepancy>({ provider: PROVIDER, resolutionStatus: DiscrepancyStatus.discrepancy_status_pending })]
      })
    );

    const result = await service.getSummaries([PROVIDER, PROVIDER]);
    const view = result.get(PROVIDER);

    expect(repository.getSummaryState).toHaveBeenCalledWith([PROVIDER]);
    expect(repository.getCurrentState).not.toHaveBeenCalled();
    expect(ProviderVerificationListViewSchema.parse(view)).toEqual(view);
    expect(view).toEqual({
      provider: PROVIDER,
      moduleActive: true,
      summary: {
        effectiveTier: "L3",
        validAuditorCount: 1,
        capabilities: ["persistent_storage"],
        snapshotState: "current",
        maintenanceState: "scheduled",
        reviewState: "under_review"
      },
      observedAt: "2026-08-24T11:59:00.000Z",
      observedHeight: "125"
    });
  });

  it("returns null list summaries until canonical verification params have been indexed", async () => {
    const { service, repository } = setup();
    repository.getSummaryState.mockResolvedValue(summaryRows({ params: null }));

    const result = await service.getSummaries([PROVIDER]);

    expect(result.get(PROVIDER)).toBeNull();
  });

  it("returns null until canonical verification params have been indexed", async () => {
    const { service, repository } = setup();
    repository.getCurrentState.mockResolvedValue(indexedRows({ params: null }));

    const result = await service.getViews([{ provider: PROVIDER, providerDeclaredTier: "community" }]);

    expect(result.get(PROVIDER)).toBeNull();
  });

  it("maps a complete indexed provider state without chain queries", async () => {
    const { service, repository } = setup();
    repository.getCurrentState.mockResolvedValue(
      indexedRows({
        attestations: [
          row<VerificationAttestation>({
            provider: PROVIDER,
            auditor: "akash1auditor",
            tier: VerificationTier.verification_tier_identified,
            evidenceHash: Buffer.from([1, 2, 3]),
            feeDenom: "uakt",
            feeAmount: "100",
            feeStatus: 1,
            createdAt: new Date("2026-08-23T12:00:00.000Z"),
            expiresAt: new Date("2027-08-23T12:00:00.000Z"),
            status: AttestationStatus.attestation_status_valid,
            voidedReason: 0,
            depositDenom: "uakt",
            depositAmount: "1000",
            depositStatus: 1,
            auditEscrowId: "7",
            faultAttribution: 0,
            observedHeight: 125,
            observedBlockTime: new Date("2026-08-24T11:59:00.000Z")
          })
        ],
        attestationCapabilities: [
          row<VerificationAttestationCapability>({
            provider: PROVIDER,
            auditor: "akash1auditor",
            capability: CapabilityFlag.capability_persistent_storage,
            observedHeight: 125,
            observedBlockTime: new Date("2026-08-24T11:59:00.000Z")
          })
        ]
      })
    );

    const result = await service.getViews([{ provider: PROVIDER, providerDeclaredTier: "community" }]);
    const view = result.get(PROVIDER);

    expect(ProviderVerificationViewSchema.safeParse(view).success).toBe(true);
    expect(view).toMatchObject({
      provider: PROVIDER,
      providerDeclaredTier: "community",
      moduleActive: true,
      summary: {
        bestAttestedTier: "L1",
        effectiveTier: "L1",
        capabilities: ["persistent_storage"],
        validAuditorCount: 1,
        snapshotState: "not_posted"
      },
      observedHeight: "125",
      completeness: {
        params: true,
        attestations: true,
        graces: true,
        snapshot: true
      }
    });
  });

  it("marks facts unknown while provider reconciliation is pending", async () => {
    const { service, repository } = setup();
    repository.getCurrentState.mockResolvedValue(
      indexedRows({
        pendingTargets: [row<VerificationReconcileTarget>({ targetType: "provider", targetKey: PROVIDER, requestedHeight: 126 })]
      })
    );

    const result = await service.getViews([{ provider: PROVIDER, providerDeclaredTier: null }]);

    expect(result.get(PROVIDER)).toMatchObject({
      summary: {
        bestAttestedTier: null,
        effectiveTier: null,
        capabilities: null,
        snapshotState: "unknown"
      },
      completeness: {
        attestations: false,
        graces: false,
        snapshot: false,
        bond: false,
        auditEscrows: false,
        maintenance: false,
        discrepancies: false
      }
    });
  });

  it("marks an empty provider state incomplete until it has a reconciliation watermark", async () => {
    const { service, repository } = setup();
    repository.getCurrentState.mockResolvedValue(indexedRows({ providerObservations: [] }));

    const result = await service.getViews([{ provider: PROVIDER, providerDeclaredTier: null }]);

    expect(result.get(PROVIDER)).toMatchObject({
      observedHeight: "0",
      summary: { effectiveTier: null, snapshotState: "unknown" },
      completeness: { attestations: false, graces: false, snapshot: false }
    });
  });

  it("hides module activation while a canonical params refresh is pending", async () => {
    const { service, repository } = setup();
    repository.getCurrentState.mockResolvedValue(
      indexedRows({
        pendingTargets: [row<VerificationReconcileTarget>({ targetType: "global", targetKey: "*", requestedHeight: 126, invalidated: true })]
      })
    );

    const result = await service.getViews([{ provider: PROVIDER, providerDeclaredTier: null }]);

    expect(result.get(PROVIDER)).toMatchObject({ moduleActive: null, completeness: { params: false } });
  });
});

function setup() {
  const repository = mock<ProviderVerificationRepository>();
  return { repository, service: new ProviderVerificationService(repository) };
}

function indexedRows(overrides: Partial<ProviderVerificationIndexedRows> = {}): ProviderVerificationIndexedRows {
  return {
    params: row<VerificationParams>({
      id: 1,
      params: { verification_module_active: true },
      observedHeight: 100,
      observedBlockTime: new Date("2026-08-24T11:55:00.000Z")
    }),
    attestations: [],
    attestationCapabilities: [],
    auditEscrows: [],
    auditEscrowCapabilities: [],
    bonds: [],
    bondUnbondingEntries: [],
    providerObservations: [
      row<VerificationProviderObservation>({
        provider: PROVIDER,
        observedHeight: 125,
        observedBlockTime: new Date("2026-08-24T11:59:00.000Z")
      })
    ],
    graces: [],
    graceDiscrepancies: [],
    maintenances: [],
    snapshots: [],
    discrepancies: [],
    pendingTargets: [],
    hasUnprocessedBlockEvents: false,
    ...overrides
  };
}

function summaryRows(overrides: Partial<ProviderVerificationSummaryIndexedRows> = {}): ProviderVerificationSummaryIndexedRows {
  return {
    params: row<VerificationParams>({
      id: 1,
      params: { verification_module_active: true },
      observedHeight: 100,
      observedBlockTime: new Date("2026-08-24T11:55:00.000Z")
    }),
    attestations: [],
    attestationCapabilities: [],
    providerObservations: [
      row<VerificationProviderObservation>({
        provider: PROVIDER,
        observedHeight: 125,
        observedBlockTime: new Date("2026-08-24T11:59:00.000Z")
      })
    ],
    graces: [],
    maintenances: [],
    snapshots: [],
    discrepancies: [],
    pendingTargets: [],
    hasUnprocessedBlockEvents: false,
    ...overrides
  };
}

function row<T>(value: Partial<T>): T {
  return value as T;
}
