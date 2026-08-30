import {
  ProviderMaintenance,
  VerificationAttestation,
  VerificationAttestationCapability,
  VerificationAuditEscrow,
  VerificationAuditEscrowCapability,
  VerificationBlockEvent,
  VerificationDiscrepancy,
  VerificationGrace,
  VerificationGraceDiscrepancy,
  VerificationParams,
  VerificationProviderBond,
  VerificationProviderBondUnbonding,
  VerificationProviderObservation,
  VerificationProviderSnapshot,
  VerificationReconcileTarget
} from "@akashnetwork/database/dbSchemas/akash";
import type { Sequelize, Transaction as DbTransaction } from "sequelize";
import { Op, Transaction } from "sequelize";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProviderVerificationRepository } from "./provider-verification.repository";

const originalSequelizeDescriptor = Object.getOwnPropertyDescriptor(VerificationParams, "sequelize");

describe(ProviderVerificationRepository.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
    if (originalSequelizeDescriptor) {
      Object.defineProperty(VerificationParams, "sequelize", originalSequelizeDescriptor);
    } else {
      Reflect.deleteProperty(VerificationParams, "sequelize");
    }
  });

  it("loads list summaries in one transaction without querying detail-only tables", async () => {
    const transaction = {} as DbTransaction;
    const runTransaction = vi.fn(async (_options: unknown, callback: (value: DbTransaction) => unknown) => callback(transaction));
    Object.defineProperty(VerificationParams, "sequelize", {
      configurable: true,
      value: { transaction: runTransaction } as unknown as Sequelize
    });

    const params = vi.spyOn(VerificationParams, "findByPk").mockResolvedValue(null);
    const attestations = vi.spyOn(VerificationAttestation, "findAll").mockResolvedValue([]);
    vi.spyOn(VerificationAttestationCapability, "findAll").mockResolvedValue([]);
    vi.spyOn(VerificationProviderObservation, "findAll").mockResolvedValue([]);
    vi.spyOn(VerificationGrace, "findAll").mockResolvedValue([]);
    vi.spyOn(ProviderMaintenance, "findAll").mockResolvedValue([]);
    const snapshots = vi.spyOn(VerificationProviderSnapshot, "findAll").mockResolvedValue([]);
    vi.spyOn(VerificationDiscrepancy, "findAll").mockResolvedValue([]);
    vi.spyOn(VerificationReconcileTarget, "findAll").mockResolvedValue([]);
    vi.spyOn(VerificationBlockEvent, "count").mockResolvedValue(0);

    const auditEscrows = vi.spyOn(VerificationAuditEscrow, "findAll");
    const auditEscrowCapabilities = vi.spyOn(VerificationAuditEscrowCapability, "findAll");
    const bonds = vi.spyOn(VerificationProviderBond, "findAll");
    const bondUnbondingEntries = vi.spyOn(VerificationProviderBondUnbonding, "findAll");
    const graceDiscrepancies = vi.spyOn(VerificationGraceDiscrepancy, "findAll");

    await new ProviderVerificationRepository().getSummaryState(["akash1provider-a", "akash1provider-b"]);

    expect(runTransaction).toHaveBeenCalledWith({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ }, expect.any(Function));
    expect(params).toHaveBeenCalledWith(1, { attributes: ["params"], transaction });
    expect(attestations).toHaveBeenCalledWith({
      attributes: ["provider", "auditor", "tier", "status"],
      where: { provider: { [Op.in]: ["akash1provider-a", "akash1provider-b"] } },
      transaction
    });
    expect(snapshots).toHaveBeenCalledWith({
      attributes: ["provider", "complianceDeadline", "suspended"],
      where: expect.any(Object),
      transaction
    });
    expect(auditEscrows).not.toHaveBeenCalled();
    expect(auditEscrowCapabilities).not.toHaveBeenCalled();
    expect(bonds).not.toHaveBeenCalled();
    expect(bondUnbondingEntries).not.toHaveBeenCalled();
    expect(graceDiscrepancies).not.toHaveBeenCalled();
  });
});
