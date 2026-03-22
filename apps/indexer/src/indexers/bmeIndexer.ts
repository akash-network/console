import type { AkashBlock as Block } from "@akashnetwork/database/dbSchemas/akash";
import { BmeLedgerRecord, BmeRawEvent, BmeStatusChange, Deployment, Lease } from "@akashnetwork/database/dbSchemas/akash";
import type { Transaction, TransactionEvent } from "@akashnetwork/database/dbSchemas/base";
import type { DecodedTxRaw } from "@cosmjs/proto-signing";
import type { Transaction as DbTransaction } from "sequelize";
import { QueryTypes } from "sequelize";

import type { IGenesis } from "@src/chain/genesisTypes";
import { sequelize } from "@src/db/dbConnection";
import * as benchmark from "@src/shared/utils/benchmark";
import {
  accumulateLedgerSums,
  parseLedgerRecordEvent,
  parsePriceDataEvent,
  parseStatusChangeEvent,
  parseVaultSeededEvent,
  safeParseFloat,
  zeroBmeSums
} from "./bmeIndexer.helpers";
import { Indexer } from "./indexer";

export const BME_EVENT_TYPES = {
  LEDGER_RECORD_EXECUTED: "akash.bme.v1.EventLedgerRecordExecuted",
  MINT_STATUS_CHANGE: "akash.bme.v1.EventMintStatusChange",
  VAULT_SEEDED: "akash.bme.v1.EventVaultSeeded",
  LEDGER_RECORD_CANCELED: "akash.bme.v1.EventLedgerRecordCanceled",
  /** Synthetic event: uakt transfer to vault detected in finalize_block_events (governance/upgrade seed) */
  VAULT_FUNDED_TRANSFER: "indexer.bme.VaultFundedTransfer",
  /** Synthetic event: uact minted during BME migration (USDC or AKT denom conversion) */
  MIGRATION_MINTED: "indexer.bme.MigrationMinted"
} as const;

export const ORACLE_EVENT_TYPES = {
  PRICE_DATA: "akash.oracle.v1.EventPriceData"
} as const;

const BME_EVENT_TYPE_VALUES = Object.values(BME_EVENT_TYPES);

export { BME_EVENT_TYPE_VALUES };

/** Native on-chain BME events (emitted only after the BME module is activated at the upgrade block). */
const NATIVE_BME_EVENT_TYPES: readonly string[] = [
  BME_EVENT_TYPES.LEDGER_RECORD_EXECUTED,
  BME_EVENT_TYPES.MINT_STATUS_CHANGE,
  BME_EVENT_TYPES.VAULT_SEEDED,
  BME_EVENT_TYPES.LEDGER_RECORD_CANCELED
];

export const BME_BLOCK_EVENT_TYPE_VALUES = [...BME_EVENT_TYPE_VALUES];

export class BmeIndexer extends Indexer {
  private usdcMigrated = false;

  private aktMigrated = false;

  private healthyStatusSeen = false;

  constructor() {
    super();
    this.name = "BmeIndexer";
    this.runForEveryBlocks = true;
    this.processFailedTxs = false;
    this.msgHandlers = {};
  }

  @benchmark.measureMethodAsync
  async dropTables(): Promise<void> {
    await BmeLedgerRecord.drop({ cascade: true });
    await BmeStatusChange.drop({ cascade: true });
    await BmeRawEvent.drop({ cascade: true });
  }

  async createTables(): Promise<void> {
    await BmeRawEvent.sync({ force: false });
    await BmeLedgerRecord.sync({ force: false });
    await BmeStatusChange.sync({ force: false });
  }

  async initCache(): Promise<void> {
    // Derive migration flags from remaining legacy-denom rows, not event history.
    // This handles cold starts after the transition was already indexed by older code.
    // Also require BME events to exist — on a fresh reindex the DB starts empty, so
    // activeUusdcCount=0 would incorrectly mark migration as done before the upgrade.
    const bmeModuleActive = (await BmeRawEvent.count()) > 0;
    const activeUusdcCount =
      (await Deployment.count({ where: { denom: "uusdc", closedHeight: null } })) + (await Lease.count({ where: { denom: "uusdc", closedHeight: null } }));
    this.usdcMigrated = bmeModuleActive && activeUusdcCount === 0;

    const healthyStatusExists = await BmeStatusChange.count({ where: { newStatus: "mint_status_healthy" } });
    this.healthyStatusSeen = healthyStatusExists > 0;

    const activeUaktCount = this.healthyStatusSeen
      ? (await Deployment.count({ where: { denom: "uakt", closedHeight: null } })) + (await Lease.count({ where: { denom: "uakt", closedHeight: null } }))
      : 1;
    this.aktMigrated = this.healthyStatusSeen && activeUaktCount === 0;
  }

  seed(_genesis: IGenesis): Promise<void> {
    return Promise.resolve();
  }

  // BME events only appear in end_block_events, never in transaction events
  async afterEveryTransaction(
    _rawTx: DecodedTxRaw,
    _currentTransaction: Transaction,
    _dbTransaction: DbTransaction,
    _txEvents: TransactionEvent[]
  ): Promise<void> {}

  @benchmark.measureMethodAsync
  async afterEveryBlock(currentBlock: Block, previousBlock: Block, dbTransaction: DbTransaction): Promise<void> {
    const rawEvents = await BmeRawEvent.findAll({
      where: { height: currentBlock.height, isProcessed: false },
      order: [["index", "ASC"]],
      transaction: dbTransaction
    });

    // USDC → ACT: triggered when the first native BME event appears (upgrade block).
    // Synthetic events (indexer.bme.*) can appear before the upgrade, so we only
    // gate on native on-chain events (akash.bme.v1.*) to avoid premature conversion.
    if (!this.usdcMigrated && rawEvents.some(e => NATIVE_BME_EVENT_TYPES.includes(e.type))) {
      await this.migrateUsdcToAct(dbTransaction);
      this.usdcMigrated = true;
    }

    let vaultUaktFromEvent: number | null = null;
    let vaultFundedAmount = 0;
    let aktUsdPrice: string | null = null;
    let migrationMintedFromEvents = 0;
    const blockLevelSums = zeroBmeSums();
    const ledgerRecords: Array<Parameters<typeof BmeLedgerRecord.bulkCreate>[0][number]> = [];
    const statusChanges: Array<Parameters<typeof BmeStatusChange.bulkCreate>[0][number]> = [];

    for (const rawEvent of rawEvents) {
      if (rawEvent.type === BME_EVENT_TYPES.LEDGER_RECORD_EXECUTED) {
        const parsed = parseLedgerRecordEvent(rawEvent.data);
        ledgerRecords.push({ height: currentBlock.height, ...parsed });
        accumulateLedgerSums(blockLevelSums, parsed);
      } else if (rawEvent.type === BME_EVENT_TYPES.MINT_STATUS_CHANGE) {
        const parsed = parseStatusChangeEvent(rawEvent.data);
        statusChanges.push({ height: currentBlock.height, ...parsed });
      } else if (rawEvent.type === BME_EVENT_TYPES.VAULT_SEEDED) {
        const parsed = parseVaultSeededEvent(rawEvent.data);
        if (parsed.newVaultBalance && parsed.newVaultBalance.denom === "uakt") {
          const amount = safeParseFloat(parsed.newVaultBalance.amount);
          vaultUaktFromEvent = amount;
        }
      } else if (rawEvent.type === BME_EVENT_TYPES.VAULT_FUNDED_TRANSFER) {
        // Synthetic event: uakt transfer to vault from governance/upgrade (not a user deposit).
        // Adds to vault balance as a delta since we don't have an absolute snapshot.
        vaultFundedAmount += safeParseFloat(rawEvent.data.amount as string);
      } else if (rawEvent.type === BME_EVENT_TYPES.MIGRATION_MINTED) {
        // Synthetic event: exact uact minted by the chain during BME migration.
        // Created by chainSync.ts when it detects burn(old denom)→coinbase(uact) at BME vault.
        migrationMintedFromEvents += safeParseFloat(rawEvent.data.amount as string);
        // During migration, AKT from lease escrows is transferred to the vault then immediately burned.
        // The transfer is already counted in vaultFundedAmount, so subtract the burned AKT to avoid double-counting.
        vaultFundedAmount -= safeParseFloat((rawEvent.data.burnedUakt as string) || "0");
      }
      // LEDGER_RECORD_CANCELED: no supply impact (record was canceled before execution).
      // Raw event is kept in bme_raw_event for audit purposes.
    }

    if (!this.healthyStatusSeen && statusChanges.some(sc => sc.newStatus === "mint_status_healthy")) {
      this.healthyStatusSeen = true;
    }

    // Oracle price events come via wasm tx (not EndBlocker), so query transaction events directly.
    // Skip until healthy status is seen — no point querying for AKT/USD price before the oracle is active.
    if (!this.aktMigrated && this.healthyStatusSeen) {
      const priceAttrs = await sequelize.query<{ key: string; value: string; eventId: number }>(
        `SELECT tea.key, tea.value, te.id AS "eventId" FROM transaction_event te
         JOIN transaction t ON t.id = te.tx_id
         JOIN transaction_event_attribute tea ON tea.transaction_event_id = te.id
         WHERE te.height = :height AND te.type = :type AND t."hasProcessingError" = false
         ORDER BY te.id ASC`,
        { transaction: dbTransaction, type: QueryTypes.SELECT, replacements: { height: currentBlock.height, type: ORACLE_EVENT_TYPES.PRICE_DATA } }
      );
      if (priceAttrs.length > 0) {
        const eventGroups = new Map<number, Record<string, string | null>>();
        for (const attr of priceAttrs) {
          let group = eventGroups.get(attr.eventId);
          if (!group) {
            group = {};
            eventGroups.set(attr.eventId, group);
          }
          group[attr.key] = attr.value;
        }
        const aktUsdPrices: string[] = [];
        for (const data of eventGroups.values()) {
          const parsed = parsePriceDataEvent(data);
          if ((parsed.denom === "uakt" || parsed.denom === "akt") && parsed.baseDenom === "usd") {
            aktUsdPrices.push(parsed.price);
          }
        }
        if (aktUsdPrices.length === 1) {
          aktUsdPrice = aktUsdPrices[0];
        } else if (aktUsdPrices.length > 1) {
          const distinct = [...new Set(aktUsdPrices)];
          if (distinct.length > 1) {
            console.warn(`[BME] Multiple distinct AKT/USD prices at height ${currentBlock.height}: ${distinct.join(", ")}. Using first.`);
          }
          aktUsdPrice = aktUsdPrices[0];
        }
      }
    }

    if (ledgerRecords.length > 0) {
      await BmeLedgerRecord.bulkCreate(ledgerRecords, { transaction: dbTransaction });
    }
    if (statusChanges.length > 0) {
      await BmeStatusChange.bulkCreate(statusChanges, { transaction: dbTransaction });
    }
    if (rawEvents.length > 0) {
      await BmeRawEvent.update({ isProcessed: true }, { where: { height: currentBlock.height, isProcessed: false }, transaction: dbTransaction });
    }

    // AKT → ACT: triggered when oracle becomes healthy
    if (!this.aktMigrated) {
      const statusBecameHealthy = statusChanges.some(sc => sc.newStatus === "mint_status_healthy");

      if (statusBecameHealthy && aktUsdPrice) {
        await this.migrateAktToAct(dbTransaction, aktUsdPrice);
        this.aktMigrated = true;
      } else if (statusBecameHealthy && !aktUsdPrice) {
        console.warn(
          `[BmeIndexer] Mint status became healthy at block ${currentBlock.height} but no AKT/USD price found. Will retry on next block with price data.`
        );
      } else if (!statusBecameHealthy && aktUsdPrice) {
        // Fallback: price arrived but status change was in a prior block
        const healthyStatus = await BmeStatusChange.findOne({
          where: { newStatus: "mint_status_healthy" },
          transaction: dbTransaction
        });
        if (healthyStatus) {
          await this.migrateAktToAct(dbTransaction, aktUsdPrice);
          this.aktMigrated = true;
        }
      }
    }

    const sums = blockLevelSums;

    // Cumulative event-based counters (carry forward + current block delta)
    currentBlock.totalUaktBurnedForUact = (previousBlock?.totalUaktBurnedForUact || 0) + sums.aktBurnedForAct;
    currentBlock.totalUactMinted = (previousBlock?.totalUactMinted || 0) + sums.actMinted + migrationMintedFromEvents;
    currentBlock.totalUactBurnedForUakt = (previousBlock?.totalUactBurnedForUakt || 0) + sums.actBurnedForAkt;
    currentBlock.totalUaktReminted = (previousBlock?.totalUaktReminted || 0) + sums.aktReminted;

    // Vault uAKT: carry forward previous balance and apply this block's delta
    if (vaultUaktFromEvent !== null) {
      // EventVaultSeeded provides an absolute snapshot of vault balance
      currentBlock.vaultUakt = vaultUaktFromEvent;
    } else {
      // Delta: AKT deposited via mints minus AKT withdrawn via remints this block,
      // plus any vault funding from governance proposals or chain upgrades
      currentBlock.vaultUakt = (previousBlock?.vaultUakt ?? 0) + sums.aktBurnedForAct - sums.aktReminted + vaultFundedAmount;
    }

    // Outstanding uACT = total minted - total burned back (spending is a transfer, not a supply reduction)
    currentBlock.outstandingUact = currentBlock.totalUactMinted - currentBlock.totalUactBurnedForUakt;
  }

  /**
   * USDC → ACT: 1:1 denom conversion at BME upgrade block.
   * Only converts active deployments/leases in the DB.
   * The actual minted amount comes from MIGRATION_MINTED chain events.
   * Idempotent: WHERE denom = 'uusdc' ensures no double-conversion.
   */
  private async migrateUsdcToAct(dbTransaction: DbTransaction): Promise<void> {
    await sequelize.query(`UPDATE deployment SET denom = 'uact' WHERE denom = 'uusdc' AND "closedHeight" IS NULL`, {
      transaction: dbTransaction,
      type: QueryTypes.UPDATE
    });

    await sequelize.query(`UPDATE lease SET denom = 'uact' WHERE denom = 'uusdc' AND "closedHeight" IS NULL`, {
      transaction: dbTransaction,
      type: QueryTypes.UPDATE
    });
  }

  /**
   * AKT → ACT: rate-based denom conversion when oracle becomes available.
   * actValue = aktValue * aktUsdPrice (ACT is pegged 1:1 to USD).
   * Only converts active deployments/leases in the DB.
   * The actual minted amount comes from MIGRATION_MINTED chain events.
   * predictedClosedHeight is preserved (balance/price ratio unchanged by uniform scaling).
   * Idempotent: WHERE denom = 'uakt' ensures no double-conversion.
   */
  private async migrateAktToAct(dbTransaction: DbTransaction, aktUsdPrice: string): Promise<void> {
    const rate = parseFloat(aktUsdPrice);
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error(`[BmeIndexer] Invalid AKT/USD rate for migration: ${aktUsdPrice}`);
    }

    await sequelize.query(
      `UPDATE deployment SET denom = 'uact', balance = balance * :rate, deposit = CAST(deposit * :rate AS BIGINT), "withdrawnAmount" = "withdrawnAmount" * :rate WHERE denom = 'uakt' AND "closedHeight" IS NULL`,
      { transaction: dbTransaction, type: QueryTypes.UPDATE, replacements: { rate } }
    );

    await sequelize.query(
      `UPDATE lease SET denom = 'uact', price = price * :rate, "withdrawnAmount" = "withdrawnAmount" * :rate WHERE denom = 'uakt' AND "closedHeight" IS NULL`,
      { transaction: dbTransaction, type: QueryTypes.UPDATE, replacements: { rate } }
    );
  }
}
