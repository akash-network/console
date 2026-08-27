import { describe, expect, it } from "vitest";

import type { ProviderVerificationView } from "@src/types/provider";
import { ProviderVerificationDetails } from "./ProviderVerificationDetails";
import { ProviderVerificationListCell } from "./ProviderVerificationListCell";

import { render, screen } from "@testing-library/react";

describe(ProviderVerificationListCell.name, () => {
  it("shows the complete compact verification state", () => {
    render(<ProviderVerificationListCell verification={buildVerification()} />);

    expect(screen.getByText("L3")).toBeInTheDocument();
    expect(screen.getByText("2 auditors")).toBeInTheDocument();
    expect(screen.getByText("Persistent storage")).toBeInTheDocument();
    expect(screen.getByText("Bare metal")).toBeInTheDocument();
    expect(screen.getByLabelText("Provider-signed inventory: Current")).toBeInTheDocument();
    expect(screen.getByLabelText("Maintenance: Active")).toBeInTheDocument();
    expect(screen.getByLabelText("Discrepancy review: Grace active")).toBeInTheDocument();
  });

  it("does not infer a pass from missing indexed state", () => {
    render(<ProviderVerificationListCell verification={null} />);

    expect(screen.getByText("Not evaluated")).toBeInTheDocument();
  });
});

describe(ProviderVerificationDetails.name, () => {
  it("renders the normalized provider verification lifecycle with provenance", () => {
    render(<ProviderVerificationDetails providerDeclaredTier="community" verification={buildVerification()} />);

    expect(screen.getByText("Auditor-attested capabilities")).toBeInTheDocument();
    expect(screen.getByText("Latest provider-signed inventory")).toBeInTheDocument();
    expect(screen.getByText("Attestation records")).toBeInTheDocument();
    expect(screen.getByText("Audit escrow lifecycle")).toBeInTheDocument();
    expect(screen.getByText("Maintenance windows")).toBeInTheDocument();
    expect(screen.getByText("Open discrepancies and grace")).toBeInTheDocument();
    expect(screen.getByText("community")).toBeInTheDocument();
    expect(screen.getAllByText("L3").length).toBeGreaterThan(0);
    expect(screen.getAllByText("akash1auditoralpha").length).toBeGreaterThan(0);
    expect(screen.getAllByText("100,000,000 uakt").length).toBeGreaterThan(0);
    expect(screen.getAllByText("#23").length).toBeGreaterThan(0);
  });

  it("labels incomplete checks as not evaluated", () => {
    const verification = buildVerification();
    verification.summary.effectiveTier = null;
    verification.summary.capabilities = null;
    verification.summary.validAuditorCount = null;
    verification.summary.snapshotState = "unknown";
    verification.snapshot = null;
    verification.bond = null;
    verification.attestations = [];
    verification.auditEscrows = [];
    verification.maintenance = [];
    verification.discrepancies = [];
    verification.grace = null;
    verification.completeness = {
      params: true,
      attestations: false,
      graces: false,
      snapshot: false,
      bond: false,
      auditEscrows: false,
      maintenance: false,
      discrepancies: false
    };

    render(<ProviderVerificationDetails providerDeclaredTier={null} verification={verification} />);

    expect(screen.getAllByText("Not evaluated").length).toBeGreaterThanOrEqual(6);
    expect(screen.queryByText("Passed")).not.toBeInTheDocument();
  });
});

function buildVerification(): ProviderVerificationView {
  return {
    provider: "akash1provider",
    providerDeclaredTier: "community",
    moduleActive: true,
    provenance: {
      providerTier: "provider self-declared",
      inventory: "provider-signed inventory",
      attestations: "auditor-attested"
    },
    summary: {
      bestAttestedTier: "L3",
      effectiveTier: "L3",
      capabilities: ["persistent_storage", "bare_metal"],
      validAttestationCount: 2,
      validAuditorCount: 2,
      validAuditors: ["akash1auditoralpha", "akash1auditorbeta"],
      snapshotState: "current",
      maintenanceState: "active",
      reviewState: "grace"
    },
    attestations: [
      {
        provider: "akash1provider",
        auditor: "akash1auditoralpha",
        tier: "L3",
        capabilities: ["persistent_storage"],
        evidenceHash: "ZXZpZGVuY2U=",
        fee: { denom: "uakt", amount: "10000000" },
        feeStatus: "escrowed",
        createdAt: "2026-08-23T12:00:00.000Z",
        expiresAt: "2027-08-23T12:00:00.000Z",
        status: "valid",
        voidedReason: "unspecified",
        deposit: { denom: "uakt", amount: "100000000" },
        depositStatus: "escrowed",
        auditEscrowId: "23",
        faultAttribution: "unspecified"
      }
    ],
    bond: {
      provider: "akash1provider",
      bondedAmount: { denom: "uakt", amount: "1000000000" },
      requiredForCurrentTier: { denom: "uakt", amount: "1000000000" },
      unbondingEntries: [],
      slashed: false,
      lastSlashTime: null
    },
    snapshot: {
      provider: "akash1provider",
      snapshotHash: "c25hcHNob3Q=",
      resourceSummary: {
        totalGpus: 1,
        totalVcpus: 16,
        totalMemoryMb: "65536",
        totalStorageMb: "1048576",
        activeLeases: 4,
        softwareVersion: "v0.16.0-a4",
        softwareSignature: "c2lnbmF0dXJl",
        softwareIdentity: null
      },
      postedAt: "2026-08-24T10:00:00.000Z",
      snapshotTimestamp: "2026-08-24T09:59:00.000Z",
      complianceDeadline: "2026-08-24T11:00:00.000Z",
      suspended: false
    },
    grace: {
      id: "31",
      provider: "akash1provider",
      preservedTier: "L3",
      sourceDiscrepancyIds: ["8"],
      startedAt: "2026-08-24T08:00:00.000Z",
      expiresAt: "2026-08-25T08:00:00.000Z",
      status: "active"
    },
    auditEscrows: [
      {
        id: "23",
        provider: "akash1provider",
        consumedByAuditor: "akash1auditoralpha",
        requestedTier: "L3",
        requestedCapabilities: ["persistent_storage"],
        fee: { denom: "uakt", amount: "10000000" },
        feeStatus: "escrowed",
        providerDeposit: { denom: "uakt", amount: "100000000" },
        providerDepositStatus: "escrowed",
        status: "consumed",
        openedAt: "2026-08-23T10:00:00.000Z",
        consumedAt: "2026-08-23T12:00:00.000Z",
        expiresAt: "2026-08-25T10:00:00.000Z",
        metadataHash: null,
        settlementReason: "unspecified",
        faultAttribution: "unspecified"
      }
    ],
    maintenance: [
      {
        record: {
          id: "4",
          provider: "akash1provider",
          maintenanceType: "planned",
          startsAt: "2026-08-24T10:00:00.000Z",
          expectedEndsAt: "2026-08-24T12:00:00.000Z",
          openedAt: "2026-08-23T10:00:00.000Z",
          closedAt: null,
          metadataHash: null
        },
        status: "active"
      }
    ],
    discrepancies: [
      {
        id: "8",
        provider: "akash1provider",
        auditorA: "akash1auditoralpha",
        auditorATier: "L3",
        auditorB: "akash1auditorbeta",
        auditorBTier: "L1",
        timestamp: "2026-08-24T08:00:00.000Z",
        resolutionStatus: "pending",
        resolutionProposalId: "0",
        graceRecordId: "31",
        resolutionReason: "unspecified",
        faultAttribution: "unspecified",
        resolutionEvidenceHash: null
      }
    ],
    observedAt: "2026-08-24T10:05:00.000Z",
    observedHeight: "1020781",
    completeness: {
      params: true,
      attestations: true,
      graces: true,
      snapshot: true,
      bond: true,
      auditEscrows: true,
      maintenance: true,
      discrepancies: true
    }
  };
}
