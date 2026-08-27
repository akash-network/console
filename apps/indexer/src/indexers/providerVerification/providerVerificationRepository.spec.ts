import { VerificationTier } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProviderVerificationRepository } from "./providerVerificationRepository";
import type { ProviderVerificationProviderRows } from "./providerVerificationStateMapper";

const mocks = vi.hoisted(() => {
  const transaction = { id: "provider-replacement" };
  const model = () => ({
    bulkCreate: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(0),
    findAll: vi.fn().mockResolvedValue([]),
    findByPk: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue([0]),
    upsert: vi.fn().mockResolvedValue(undefined)
  });
  const connection = {
    query: vi.fn().mockResolvedValue([]),
    transaction: vi.fn(async (callback: (transaction: { id: string }) => Promise<boolean>) => callback(transaction))
  };
  const models = {
    ProviderMaintenance: model(),
    VerificationAttestation: model(),
    VerificationAttestationCapability: model(),
    VerificationAuditEscrow: model(),
    VerificationAuditEscrowCapability: model(),
    VerificationAuditor: model(),
    VerificationBlockEvent: model(),
    VerificationDiscrepancy: model(),
    VerificationGrace: model(),
    VerificationGraceDiscrepancy: model(),
    VerificationParams: model(),
    VerificationProviderBond: model(),
    VerificationProviderBondUnbonding: model(),
    VerificationProviderObservation: model(),
    VerificationProviderSnapshot: model(),
    VerificationProviderTierDemotion: model(),
    VerificationReconcileTarget: { ...model(), sequelize: connection }
  };

  return { connection, models, transaction };
});

vi.mock("@akashnetwork/database/dbSchemas/akash", () => mocks.models);

describe(`${ProviderVerificationRepository.name}.replaceProviderState`, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connection.query.mockResolvedValue([]);
    mocks.models.VerificationAuditEscrow.findAll.mockResolvedValue([]);
    mocks.models.VerificationGrace.findAll.mockResolvedValue([]);
    mocks.models.VerificationProviderObservation.findByPk.mockResolvedValue(null);
  });

  it("establishes the first tier observation without emitting a demotion", async () => {
    const rows = providerRows();

    await expect(new ProviderVerificationRepository().replaceProviderState(rows)).resolves.toBe(true);

    expect(mocks.models.VerificationProviderTierDemotion.create).not.toHaveBeenCalled();
    expect(mocks.models.VerificationProviderObservation.upsert).toHaveBeenCalledWith(
      {
        provider: rows.provider,
        observedHeight: rows.observedHeight,
        observedBlockTime: rows.observedBlockTime,
        effectiveTier: rows.tierState.effectiveTier,
        maxPlacementTier: rows.tierState.maxPlacementTier,
        snapshotState: rows.tierState.snapshotState
      },
      { transaction: mocks.transaction }
    );
  });

  it("inserts one demotion in the provider replacement transaction", async () => {
    mocks.models.VerificationProviderObservation.findByPk.mockResolvedValue({
      observedHeight: 99,
      effectiveTier: VerificationTier.verification_tier_established,
      maxPlacementTier: VerificationTier.verification_tier_established,
      snapshotState: "current"
    });
    const rows = providerRows({
      tierState: {
        effectiveTier: VerificationTier.verification_tier_verified,
        maxPlacementTier: VerificationTier.verification_tier_identified,
        snapshotState: "stale"
      }
    });

    await expect(new ProviderVerificationRepository().replaceProviderState(rows)).resolves.toBe(true);

    expect(mocks.models.VerificationProviderTierDemotion.create).toHaveBeenCalledTimes(1);
    expect(mocks.models.VerificationProviderTierDemotion.create).toHaveBeenCalledWith(
      {
        provider: rows.provider,
        previousEffectiveTier: VerificationTier.verification_tier_established,
        previousMaxPlacementTier: VerificationTier.verification_tier_established,
        previousSnapshotState: "current",
        currentEffectiveTier: VerificationTier.verification_tier_verified,
        currentMaxPlacementTier: VerificationTier.verification_tier_identified,
        currentSnapshotState: "stale",
        changes: ["tier_gate", "snapshot_eligibility"],
        observedHeight: rows.observedHeight,
        observedBlockTime: rows.observedBlockTime
      },
      { transaction: mocks.transaction }
    );
  });

  it.each([100, 101])("rejects an observation at or below the existing height %s", async observedHeight => {
    mocks.models.VerificationProviderObservation.findByPk.mockResolvedValue({
      observedHeight,
      effectiveTier: VerificationTier.verification_tier_established,
      maxPlacementTier: VerificationTier.verification_tier_established,
      snapshotState: "current"
    });

    await expect(new ProviderVerificationRepository().replaceProviderState(providerRows())).resolves.toBe(false);

    expect(mocks.models.VerificationAttestation.destroy).not.toHaveBeenCalled();
    expect(mocks.models.VerificationProviderTierDemotion.create).not.toHaveBeenCalled();
    expect(mocks.models.VerificationProviderObservation.upsert).not.toHaveBeenCalled();
  });
});

function providerRows(overrides: Partial<ProviderVerificationProviderRows> = {}): ProviderVerificationProviderRows {
  return {
    provider: "akash1provider",
    observedHeight: 100,
    observedBlockTime: new Date("2026-08-24T12:00:00.000Z"),
    tierState: {
      effectiveTier: VerificationTier.verification_tier_established,
      maxPlacementTier: VerificationTier.verification_tier_established,
      snapshotState: "current"
    },
    attestations: [],
    attestationCapabilities: [],
    auditEscrows: [],
    auditEscrowCapabilities: [],
    bond: null,
    bondUnbondingEntries: [],
    grace: null,
    graceDiscrepancies: [],
    maintenances: [],
    snapshot: null,
    ...overrides
  };
}
