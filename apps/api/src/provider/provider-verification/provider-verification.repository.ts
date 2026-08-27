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
import type { Transaction as DbTransaction } from "sequelize";
import { Op, Transaction } from "sequelize";
import { singleton } from "tsyringe";

export interface ProviderVerificationSummaryIndexedRows {
  params: VerificationParams | null;
  attestations: VerificationAttestation[];
  attestationCapabilities: VerificationAttestationCapability[];
  providerObservations: VerificationProviderObservation[];
  graces: VerificationGrace[];
  maintenances: ProviderMaintenance[];
  snapshots: VerificationProviderSnapshot[];
  discrepancies: VerificationDiscrepancy[];
  pendingTargets: VerificationReconcileTarget[];
  hasUnprocessedBlockEvents: boolean;
}

export interface ProviderVerificationIndexedRows extends ProviderVerificationSummaryIndexedRows {
  auditEscrows: VerificationAuditEscrow[];
  auditEscrowCapabilities: VerificationAuditEscrowCapability[];
  bonds: VerificationProviderBond[];
  bondUnbondingEntries: VerificationProviderBondUnbonding[];
  graceDiscrepancies: VerificationGraceDiscrepancy[];
}

@singleton()
export class ProviderVerificationRepository {
  async getSummaryState(providers: string[]): Promise<ProviderVerificationSummaryIndexedRows> {
    const connection = VerificationParams.sequelize;
    if (!connection) throw new Error("Provider verification models are not registered with a database connection");

    return connection.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ }, transaction =>
      this.getSummaryStateInTransaction(providers, transaction)
    );
  }

  async getCurrentState(providers: string[]): Promise<ProviderVerificationIndexedRows> {
    const connection = VerificationParams.sequelize;
    if (!connection) throw new Error("Provider verification models are not registered with a database connection");

    return connection.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ }, transaction =>
      this.getCurrentStateInTransaction(providers, transaction)
    );
  }

  private async getSummaryStateInTransaction(providers: string[], transaction: DbTransaction): Promise<ProviderVerificationSummaryIndexedRows> {
    const providerWhere = { [Op.in]: providers };
    const params = await VerificationParams.findByPk(1, { attributes: ["params"], transaction });
    const attestations = await VerificationAttestation.findAll({
      attributes: ["provider", "auditor", "tier", "status"],
      where: { provider: providerWhere },
      transaction
    });
    const attestationCapabilities = await VerificationAttestationCapability.findAll({
      attributes: ["provider", "auditor", "capability"],
      where: { provider: providerWhere },
      transaction
    });
    const providerObservations = await VerificationProviderObservation.findAll({
      attributes: ["provider", "observedHeight", "observedBlockTime"],
      where: { provider: providerWhere },
      transaction
    });
    const graces = await VerificationGrace.findAll({
      attributes: ["provider", "preservedTier", "status", "observedHeight"],
      where: { provider: providerWhere },
      transaction
    });
    const maintenances = await ProviderMaintenance.findAll({
      attributes: ["provider", "status"],
      where: { provider: providerWhere },
      transaction
    });
    const snapshots = await VerificationProviderSnapshot.findAll({
      attributes: ["provider", "complianceDeadline", "suspended"],
      where: { provider: providerWhere },
      transaction
    });
    const discrepancies = await VerificationDiscrepancy.findAll({
      attributes: ["provider", "resolutionStatus"],
      where: { provider: providerWhere },
      transaction
    });
    const pendingTargets = await this.getPendingTargets(providers, transaction);
    const unprocessedBlockEventCount = await VerificationBlockEvent.count({ where: { isProcessed: false }, transaction });

    return {
      params,
      attestations,
      attestationCapabilities,
      providerObservations,
      graces,
      maintenances,
      snapshots,
      discrepancies,
      pendingTargets,
      hasUnprocessedBlockEvents: unprocessedBlockEventCount > 0
    };
  }

  private async getCurrentStateInTransaction(providers: string[], transaction: DbTransaction): Promise<ProviderVerificationIndexedRows> {
    const providerWhere = { [Op.in]: providers };
    const params = await VerificationParams.findByPk(1, { transaction });
    const attestations = await VerificationAttestation.findAll({ where: { provider: providerWhere }, transaction });
    const attestationCapabilities = await VerificationAttestationCapability.findAll({ where: { provider: providerWhere }, transaction });
    const auditEscrows = await VerificationAuditEscrow.findAll({ where: { provider: providerWhere }, transaction });
    const auditEscrowCapabilities = await VerificationAuditEscrowCapability.findAll({
      where: { auditEscrowId: { [Op.in]: auditEscrows.map(escrow => escrow.id) } },
      transaction
    });
    const bonds = await VerificationProviderBond.findAll({ where: { provider: providerWhere }, transaction });
    const bondUnbondingEntries = await VerificationProviderBondUnbonding.findAll({ where: { provider: providerWhere }, transaction });
    const providerObservations = await VerificationProviderObservation.findAll({ where: { provider: providerWhere }, transaction });
    const graces = await VerificationGrace.findAll({ where: { provider: providerWhere }, transaction });
    const graceDiscrepancies = await VerificationGraceDiscrepancy.findAll({
      where: { graceId: { [Op.in]: graces.map(grace => grace.id) } },
      transaction
    });
    const maintenances = await ProviderMaintenance.findAll({ where: { provider: providerWhere }, transaction });
    const snapshots = await VerificationProviderSnapshot.findAll({ where: { provider: providerWhere }, transaction });
    const discrepancies = await VerificationDiscrepancy.findAll({ where: { provider: providerWhere }, transaction });
    const pendingTargets = await this.getPendingTargets(providers, transaction);
    const unprocessedBlockEventCount = await VerificationBlockEvent.count({ where: { isProcessed: false }, transaction });

    return {
      params,
      attestations,
      attestationCapabilities,
      auditEscrows,
      auditEscrowCapabilities,
      bonds,
      bondUnbondingEntries,
      providerObservations,
      graces,
      graceDiscrepancies,
      maintenances,
      snapshots,
      discrepancies,
      pendingTargets,
      hasUnprocessedBlockEvents: unprocessedBlockEventCount > 0
    };
  }

  private async getPendingTargets(providers: string[], transaction: DbTransaction): Promise<VerificationReconcileTarget[]> {
    return VerificationReconcileTarget.findAll({
      where: {
        invalidated: true,
        [Op.or]: [
          { targetType: "all_providers" },
          { targetType: "provider", targetKey: { [Op.in]: providers } },
          { targetType: { [Op.in]: ["global", "auditor", "audit_escrow", "discrepancy"] } }
        ]
      },
      transaction
    });
  }
}
