import {
  ProviderMaintenance,
  VerificationAttestation,
  VerificationAttestationCapability,
  VerificationAuditEscrow,
  VerificationAuditEscrowCapability,
  VerificationAuditor,
  VerificationBlockEvent,
  VerificationDiscrepancy,
  VerificationGrace,
  VerificationGraceDiscrepancy,
  VerificationParams,
  VerificationProviderBond,
  VerificationProviderBondUnbonding,
  VerificationProviderObservation,
  VerificationProviderSnapshot,
  VerificationProviderTierDemotion,
  VerificationReconcileTarget
} from "@akashnetwork/database/dbSchemas/akash";
import {
  detectProviderTierDemotion,
  type ProviderTierDemotionChange,
  type ProviderTierState,
  type SnapshotComplianceState
} from "@akashnetwork/provider-verification";
import type { Transaction as DbTransaction } from "sequelize";
import { Op, QueryTypes } from "sequelize";

import type { ProviderVerificationReconcileTarget, ProviderVerificationReconcileTargetType } from "./providerVerificationReconcileTarget";
import type { ProviderVerificationGlobalRows, ProviderVerificationProviderRows } from "./providerVerificationStateMapper";

export interface ClaimedProviderVerificationTarget extends ProviderVerificationReconcileTarget {
  requestedHeight: number;
  attemptCount: number;
}

export class ProviderVerificationRepository {
  async enqueue(target: ProviderVerificationReconcileTarget, requestedHeight: number, transaction?: DbTransaction, invalidated = true): Promise<void> {
    await database().query(
      `INSERT INTO verification_reconcile_target
         (target_type, target_key, requested_height, invalidated, attempt_count)
       VALUES (:targetType, :targetKey, :requestedHeight, :invalidated, 0)
       ON CONFLICT (target_type, target_key) DO UPDATE
       SET requested_height = GREATEST(verification_reconcile_target.requested_height, EXCLUDED.requested_height),
           invalidated = verification_reconcile_target.invalidated OR EXCLUDED.invalidated`,
      { replacements: { ...target, requestedHeight, invalidated }, transaction }
    );
  }

  async enqueueMany(targets: readonly ProviderVerificationReconcileTarget[], requestedHeight: number, transaction?: DbTransaction): Promise<void> {
    for (const target of targets) {
      await this.enqueue(target, requestedHeight, transaction);
    }
  }

  async enqueueAllProviders(requestedHeight: number, transaction?: DbTransaction, invalidated = true): Promise<void> {
    await database().query(
      `INSERT INTO verification_reconcile_target
         (target_type, target_key, requested_height, invalidated, attempt_count)
       SELECT 'provider', owner, :requestedHeight, :invalidated, 0
       FROM provider
       WHERE "deletedHeight" IS NULL
       ON CONFLICT (target_type, target_key) DO UPDATE
       SET requested_height = GREATEST(verification_reconcile_target.requested_height, EXCLUDED.requested_height),
           invalidated = verification_reconcile_target.invalidated OR EXCLUDED.invalidated`,
      { replacements: { requestedHeight, invalidated }, transaction }
    );
  }

  async claimNext(): Promise<ClaimedProviderVerificationTarget | null> {
    const [target] = await database().query<{
      targetType: ProviderVerificationReconcileTargetType;
      targetKey: string;
      requestedHeight: number;
      attemptCount: number;
    }>(
      `WITH candidate AS (
         SELECT target_type, target_key
         FROM verification_reconcile_target
         WHERE (claimed_at IS NULL OR claimed_at < NOW() - INTERVAL '5 minutes')
           AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
         ORDER BY requested_height ASC, target_type ASC, target_key ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       UPDATE verification_reconcile_target AS target
       SET claimed_at = NOW()
       FROM candidate
       WHERE target.target_type = candidate.target_type
         AND target.target_key = candidate.target_key
       RETURNING target.target_type AS "targetType",
                 target.target_key AS "targetKey",
                 target.requested_height AS "requestedHeight",
                 target.attempt_count AS "attemptCount"`,
      { type: QueryTypes.SELECT }
    );

    return target ?? null;
  }

  async complete(target: ClaimedProviderVerificationTarget, processedHeight: number): Promise<void> {
    const deleted = await VerificationReconcileTarget.destroy({
      where: {
        targetType: target.targetType,
        targetKey: target.targetKey,
        requestedHeight: { [Op.lte]: processedHeight }
      }
    });

    if (deleted === 0) {
      await VerificationReconcileTarget.update(
        { claimedAt: null, attemptCount: 0, nextAttemptAt: null, lastError: null },
        { where: { targetType: target.targetType, targetKey: target.targetKey } }
      );
    }
  }

  async fail(target: ClaimedProviderVerificationTarget, error: unknown): Promise<void> {
    const attemptCount = target.attemptCount + 1;
    const delaySeconds = Math.min(300, 2 ** Math.min(attemptCount, 8));
    await VerificationReconcileTarget.update(
      {
        claimedAt: null,
        attemptCount,
        nextAttemptAt: new Date(Date.now() + delaySeconds * 1_000),
        lastError: error instanceof Error ? error.message : String(error)
      },
      { where: { targetType: target.targetType, targetKey: target.targetKey } }
    );
  }

  async replaceGlobalState(rows: ProviderVerificationGlobalRows): Promise<boolean> {
    const observedHeight = globalObservedHeight(rows);

    return database().transaction(async transaction => {
      await acquireReconciliationLock("global", transaction);
      const currentHeight = await queryMaxObservedHeight(["verification_params", "verification_auditor", "verification_discrepancy"], transaction);
      if (currentHeight > observedHeight) return false;

      if (rows.params) {
        await VerificationParams.upsert({ ...rows.params }, { transaction });
      } else {
        await VerificationParams.destroy({ where: {}, transaction });
      }

      const auditorAddresses = rows.auditors.map(row => row.address);
      await VerificationAuditor.destroy({ where: auditorAddresses.length > 0 ? { address: { [Op.notIn]: auditorAddresses } } : {}, transaction });
      for (const row of rows.auditors) await VerificationAuditor.upsert({ ...row }, { transaction });

      const discrepancyIds = rows.discrepancies.map(row => row.id);
      await VerificationDiscrepancy.destroy({ where: discrepancyIds.length > 0 ? { id: { [Op.notIn]: discrepancyIds } } : {}, transaction });
      for (const row of rows.discrepancies) await VerificationDiscrepancy.upsert({ ...row }, { transaction });
      return true;
    });
  }

  async replaceProviderState(rows: ProviderVerificationProviderRows): Promise<boolean> {
    return database().transaction(async transaction => {
      const providerWhere = { provider: rows.provider };
      await acquireReconciliationLock(`provider:${rows.provider}`, transaction);
      const currentObservation = await VerificationProviderObservation.findByPk(rows.provider, {
        attributes: ["observedHeight", "effectiveTier", "maxPlacementTier", "snapshotState"],
        transaction
      });
      if (currentObservation && currentObservation.observedHeight >= rows.observedHeight) return false;

      const demotion = currentObservation ? createTierDemotion(currentObservation, rows) : null;

      const escrows = await VerificationAuditEscrow.findAll({ attributes: ["id"], where: providerWhere, transaction });
      const graces = await VerificationGrace.findAll({ attributes: ["id"], where: providerWhere, transaction });
      const escrowIds = escrows.map(record => record.id);
      const graceIds = graces.map(record => record.id);

      await VerificationAttestationCapability.destroy({ where: providerWhere, transaction });
      if (escrowIds.length > 0) {
        await VerificationAuditEscrowCapability.destroy({ where: { auditEscrowId: { [Op.in]: escrowIds } }, transaction });
      }
      if (graceIds.length > 0) {
        await VerificationGraceDiscrepancy.destroy({ where: { graceId: { [Op.in]: graceIds } }, transaction });
      }
      await VerificationProviderBondUnbonding.destroy({ where: providerWhere, transaction });

      await VerificationAttestation.destroy({ where: providerWhere, transaction });
      await VerificationAuditEscrow.destroy({ where: providerWhere, transaction });
      await VerificationProviderBond.destroy({ where: providerWhere, transaction });
      await VerificationGrace.destroy({ where: providerWhere, transaction });
      await ProviderMaintenance.destroy({ where: providerWhere, transaction });
      await VerificationProviderSnapshot.destroy({ where: providerWhere, transaction });

      if (rows.attestations.length > 0)
        await VerificationAttestation.bulkCreate(
          rows.attestations.map(row => ({ ...row })),
          { transaction }
        );
      if (rows.attestationCapabilities.length > 0) {
        await VerificationAttestationCapability.bulkCreate(
          rows.attestationCapabilities.map(row => ({ ...row })),
          { transaction }
        );
      }
      if (rows.auditEscrows.length > 0)
        await VerificationAuditEscrow.bulkCreate(
          rows.auditEscrows.map(row => ({ ...row })),
          { transaction }
        );
      if (rows.auditEscrowCapabilities.length > 0) {
        await VerificationAuditEscrowCapability.bulkCreate(
          rows.auditEscrowCapabilities.map(row => ({ ...row })),
          { transaction }
        );
      }
      if (rows.bond) await VerificationProviderBond.create({ ...rows.bond }, { transaction });
      if (rows.bondUnbondingEntries.length > 0) {
        await VerificationProviderBondUnbonding.bulkCreate(
          rows.bondUnbondingEntries.map(row => ({ ...row })),
          { transaction }
        );
      }
      if (rows.grace) await VerificationGrace.create({ ...rows.grace }, { transaction });
      if (rows.graceDiscrepancies.length > 0) {
        await VerificationGraceDiscrepancy.bulkCreate(
          rows.graceDiscrepancies.map(row => ({ ...row })),
          { transaction }
        );
      }
      if (rows.maintenances.length > 0)
        await ProviderMaintenance.bulkCreate(
          rows.maintenances.map(row => ({ ...row })),
          { transaction }
        );
      if (rows.snapshot) await VerificationProviderSnapshot.create({ ...rows.snapshot }, { transaction });
      if (demotion) await VerificationProviderTierDemotion.create({ ...demotion }, { transaction });
      await VerificationProviderObservation.upsert(
        {
          provider: rows.provider,
          observedHeight: rows.observedHeight,
          observedBlockTime: rows.observedBlockTime,
          effectiveTier: rows.tierState.effectiveTier,
          maxPlacementTier: rows.tierState.maxPlacementTier,
          snapshotState: rows.tierState.snapshotState
        },
        { transaction }
      );
      return true;
    });
  }

  async findAuditEscrowProvider(id: string): Promise<string | null> {
    return (await VerificationAuditEscrow.findByPk(id, { attributes: ["provider"] }))?.provider ?? null;
  }

  async hasDiscrepancies(ids: readonly string[]): Promise<boolean> {
    if (ids.length === 0) return true;
    return (await VerificationDiscrepancy.count({ where: { id: { [Op.in]: ids } } })) === new Set(ids).size;
  }

  async getUnprocessedBlockEvents(height: number, transaction: DbTransaction): Promise<VerificationBlockEvent[]> {
    return VerificationBlockEvent.findAll({ where: { height, isProcessed: false }, order: [["index", "ASC"]], transaction });
  }

  async markBlockEventsProcessed(height: number, transaction: DbTransaction): Promise<void> {
    await VerificationBlockEvent.update({ isProcessed: true }, { where: { height, isProcessed: false }, transaction });
  }
}

interface ProviderTierObservation {
  effectiveTier: number;
  maxPlacementTier: number;
  snapshotState: string;
}

interface ProviderTierDemotionRow {
  provider: string;
  previousEffectiveTier: number;
  previousMaxPlacementTier: number;
  previousSnapshotState: string;
  currentEffectiveTier: number;
  currentMaxPlacementTier: number;
  currentSnapshotState: string;
  changes: ProviderTierDemotionChange[];
  observedHeight: number;
  observedBlockTime: Date;
}

function createTierDemotion(current: ProviderTierObservation, rows: ProviderVerificationProviderRows): ProviderTierDemotionRow | null {
  const previous: ProviderTierState = {
    effectiveTier: current.effectiveTier,
    maxPlacementTier: current.maxPlacementTier,
    snapshotState: parseSnapshotState(current.snapshotState)
  };
  const changes = detectProviderTierDemotion(previous, rows.tierState);
  if (changes.length === 0) return null;

  return {
    provider: rows.provider,
    previousEffectiveTier: previous.effectiveTier,
    previousMaxPlacementTier: previous.maxPlacementTier,
    previousSnapshotState: previous.snapshotState,
    currentEffectiveTier: rows.tierState.effectiveTier,
    currentMaxPlacementTier: rows.tierState.maxPlacementTier,
    currentSnapshotState: rows.tierState.snapshotState,
    changes,
    observedHeight: rows.observedHeight,
    observedBlockTime: rows.observedBlockTime
  };
}

function parseSnapshotState(value: string): SnapshotComplianceState {
  switch (value) {
    case "unknown":
    case "not_posted":
    case "current":
    case "stale":
    case "suspended":
      return value;
    default:
      throw new Error(`Invalid provider verification snapshot state: ${value}`);
  }
}

async function queryMaxObservedHeight(tables: readonly string[], transaction: DbTransaction): Promise<number> {
  const selects = tables.map(table => `SELECT observed_height FROM ${table}`).join(" UNION ALL ");
  const [result] = await database().query<{ height: number | null }>(`SELECT MAX(observed_height) AS height FROM (${selects}) observations`, {
    transaction,
    type: QueryTypes.SELECT
  });
  return result?.height ?? 0;
}

function globalObservedHeight(rows: ProviderVerificationGlobalRows): number {
  return rows.observedHeight;
}

async function acquireReconciliationLock(key: string, transaction: DbTransaction): Promise<void> {
  await database().query("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))", {
    replacements: { key: `provider-verification:${key}` },
    transaction
  });
}

function database() {
  const connection = VerificationReconcileTarget.sequelize;
  if (!connection) throw new Error("Provider verification models are not registered with a database connection");
  return connection;
}
