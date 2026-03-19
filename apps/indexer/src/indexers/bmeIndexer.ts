import type { AkashBlock as Block } from "@akashnetwork/database/dbSchemas/akash";
import { BmeLedgerRecord, BmeRawEvent, BmeStatusChange } from "@akashnetwork/database/dbSchemas/akash";
import type { Transaction, TransactionEvent } from "@akashnetwork/database/dbSchemas/base";
import type { DecodedTxRaw } from "@cosmjs/proto-signing";
import type { Transaction as DbTransaction } from "sequelize";

import type { IGenesis } from "@src/chain/genesisTypes";
import * as benchmark from "@src/shared/utils/benchmark";
import { accumulateLedgerSums, parseLedgerRecordEvent, parseStatusChangeEvent, parseVaultSeededEvent, safeParseFloat, zeroBmeSums } from "./bmeIndexer.helpers";
import { Indexer } from "./indexer";

export const BME_EVENT_TYPES = {
  LEDGER_RECORD_EXECUTED: "akash.bme.v1.EventLedgerRecordExecuted",
  MINT_STATUS_CHANGE: "akash.bme.v1.EventMintStatusChange",
  VAULT_SEEDED: "akash.bme.v1.EventVaultSeeded"
} as const;

const BME_EVENT_TYPE_VALUES = Object.values(BME_EVENT_TYPES);

export { BME_EVENT_TYPE_VALUES };

export class BmeIndexer extends Indexer {
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
    return Promise.resolve();
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
      transaction: dbTransaction
    });

    let vaultUaktFromEvent: number | null = null;
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

    const sums = blockLevelSums;

    // Cumulative event-based counters (carry forward + current block delta)
    currentBlock.totalUaktBurnedForUact = (previousBlock?.totalUaktBurnedForUact || 0) + sums.aktBurnedForAct;
    currentBlock.totalUactMinted = (previousBlock?.totalUactMinted || 0) + sums.actMinted;
    currentBlock.totalUactBurnedForUakt = (previousBlock?.totalUactBurnedForUakt || 0) + sums.actBurnedForAkt;
    currentBlock.totalUaktReminted = (previousBlock?.totalUaktReminted || 0) + sums.aktReminted;

    // Vault uAKT = AKT deposited via mints minus AKT withdrawn via burns, plus any governance seed
    if (vaultUaktFromEvent !== null) {
      // EventVaultSeeded provides an absolute snapshot of vault balance
      currentBlock.vaultUakt = vaultUaktFromEvent;
    } else {
      // Compute from flows: AKT in (mints) minus AKT out (remints)
      currentBlock.vaultUakt = currentBlock.totalUaktBurnedForUact - currentBlock.totalUaktReminted;
    }

    // Outstanding uACT = total minted - total burned back - spent on deployments
    currentBlock.outstandingUact = currentBlock.totalUactMinted - currentBlock.totalUactBurnedForUakt - (currentBlock.totalUActSpent || 0);
  }
}
