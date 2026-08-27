import type { ProviderVerificationGlobalState, ProviderVerificationProviderState } from "@akashnetwork/provider-verification";
import { describe, expect, it } from "vitest";

import { mapProviderVerificationGlobalState, mapProviderVerificationProviderState } from "./providerVerificationStateMapper";

const observedBlockTime = new Date("2026-08-24T12:00:00.000Z");

describe("providerVerificationStateMapper", () => {
  it("maps provider aggregates without losing bytes or bigint values", () => {
    const state = {
      provider: "akash1provider",
      observedHeight: "1234",
      attestations: [
        {
          provider: "akash1provider",
          auditor: "akash1auditor",
          tier: 2,
          capabilities: [3, 4],
          evidenceHash: Uint8Array.from([1, 2]),
          fee: { denom: "uakt", amount: "10" },
          feeStatus: 1,
          createdAt: new Date("2026-08-01T00:00:00.000Z"),
          expiresAt: new Date("2027-08-01T00:00:00.000Z"),
          status: 1,
          voidedReason: 0,
          deposit: { denom: "uakt", amount: "20" },
          depositStatus: 1,
          auditEscrowId: 9007199254740993n,
          faultAttribution: 0
        }
      ],
      auditEscrows: [],
      bond: {
        provider: "akash1provider",
        bondedAmount: { denom: "uakt", amount: "100" },
        unbondingEntries: [],
        slashed: false,
        lastSlashTime: undefined
      },
      requiredBondForCurrentTier: { denom: "uakt", amount: "80" },
      grace: null,
      maintenances: [],
      snapshot: {
        provider: "akash1provider",
        snapshotHash: Uint8Array.from([9, 8]),
        resourceSummary: {
          totalGpus: 1,
          totalVcpus: 16,
          totalMemoryMb: 32768n,
          totalStorageMb: 1000000n,
          activeLeases: 4,
          softwareVersion: "v0.16.0",
          softwareSignature: new Uint8Array(),
          softwareIdentity: undefined
        },
        postedAt: new Date("2026-08-24T11:00:00.000Z"),
        snapshotTimestamp: new Date("2026-08-24T10:59:00.000Z"),
        complianceDeadline: new Date("2026-08-25T11:00:00.000Z"),
        suspended: false
      }
    } as ProviderVerificationProviderState;

    const rows = mapProviderVerificationProviderState(state, observedBlockTime);

    expect(rows.attestations[0]).toMatchObject({ auditEscrowId: "9007199254740993", evidenceHash: Buffer.from([1, 2]), observedHeight: 1234 });
    expect(rows.attestationCapabilities).toEqual([
      expect.objectContaining({ capability: 3, provider: "akash1provider", auditor: "akash1auditor" }),
      expect.objectContaining({ capability: 4, provider: "akash1provider", auditor: "akash1auditor" })
    ]);
    expect(rows.bond).toMatchObject({ bondedAmount: "100", requiredForCurrentTierAmount: "80" });
    expect(rows.snapshot).toMatchObject({ snapshotHash: Buffer.from([9, 8]), totalMemoryMb: "32768", softwareSignature: null });
    expect(rows.tierState).toEqual({ effectiveTier: 2, maxPlacementTier: 2, snapshotState: "current" });
  });

  it("serializes verification params and global bigint identities", () => {
    const state = {
      observedHeight: "99",
      params: { verificationModuleActive: true },
      auditors: [],
      discrepancies: [
        {
          id: 9007199254740995n,
          provider: "akash1provider",
          auditorA: "akash1a",
          auditorATier: 1,
          auditorB: "akash1b",
          auditorBTier: 3,
          timestamp: observedBlockTime,
          resolutionStatus: 1,
          resolutionProposalId: 0n,
          graceRecordId: 12n,
          resolutionReason: 0,
          faultAttribution: 0,
          resolutionEvidenceHash: new Uint8Array()
        }
      ]
    } as unknown as ProviderVerificationGlobalState;

    const rows = mapProviderVerificationGlobalState(state, observedBlockTime);

    expect(rows.params).toMatchObject({ id: 1, observedHeight: 99, params: { verification_module_active: true } });
    expect(rows.discrepancies[0]).toMatchObject({ id: "9007199254740995", graceRecordId: "12", resolutionEvidenceHash: null });
  });

  it("persists an inactive verification module as false", () => {
    const state = {
      observedHeight: "100",
      params: { verificationModuleActive: false },
      auditors: [],
      discrepancies: []
    } as unknown as ProviderVerificationGlobalState;

    const rows = mapProviderVerificationGlobalState(state, observedBlockTime);

    expect(rows.params?.params).toMatchObject({ verification_module_active: false });
  });

  it("rejects incomplete chain records instead of inventing timestamps", () => {
    const state = {
      provider: "akash1provider",
      observedHeight: "1",
      attestations: [],
      auditEscrows: [],
      bond: null,
      requiredBondForCurrentTier: null,
      grace: null,
      snapshot: null,
      maintenances: [{ record: undefined, status: 1 }]
    } as ProviderVerificationProviderState;

    expect(() => mapProviderVerificationProviderState(state, observedBlockTime)).toThrow("maintenance.record is missing");
  });
});
