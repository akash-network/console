import { SinkTotalsSnapshot, SinkTransfer } from "@akashnetwork/database/dbSchemas/akash";
import type { Block, Transaction, TransactionEvent } from "@akashnetwork/database/dbSchemas/base";
import { LoggerService } from "@akashnetwork/logging";
import type { DecodedTxRaw } from "@cosmjs/proto-signing";
import type { Transaction as DbTransaction } from "sequelize";

import type { BlockResultsReader } from "@src/chain/blockResultsReader";
import type { EventType } from "@src/shared/types";
import * as benchmark from "@src/shared/utils/benchmark";
import { Indexer } from "./indexer";
import { findBlockLevelSinkTotalsEvents, findLastSinkTotalsEvent, parseSinkTotals } from "./sinkIndexer.helpers";
import type { SinkTransferChange, SinkTransferCreation, SinkTransferStatus, SinkTransferStatusChange } from "./sinkTransfer.helpers";
import { applySinkTransferChange, readSinkTransferChanges } from "./sinkTransfer.helpers";

export class SinkIndexer extends Indexer {
  constructor(
    private readonly readBlockResults: BlockResultsReader,
    private readonly logger = LoggerService.forContext("SinkIndexer")
  ) {
    super();
    this.name = "SinkIndexer";
    this.runForEveryBlocks = true;
    this.processFailedTxs = false;
    this.msgHandlers = {};
  }

  @benchmark.measureMethodAsync
  async dropTables(): Promise<void> {
    await SinkTotalsSnapshot.drop({ cascade: true });
    await SinkTransfer.drop({ cascade: true });
  }

  async createTables(): Promise<void> {
    await SinkTotalsSnapshot.sync({ force: false });
    await SinkTransfer.sync({ force: false });
  }

  initCache(): Promise<void> {
    return Promise.resolve();
  }

  seed(): Promise<void> {
    return Promise.resolve();
  }

  async afterEveryBlock(currentBlock: Block, _previousBlock: Block | null, dbTransaction: DbTransaction): Promise<void> {
    const { finalize_block_events: blockEvents } = await this.readBlockResults(currentBlock.height);

    await this.saveBlockLevelTotals(blockEvents ?? [], currentBlock.height, dbTransaction);
    await this.saveTransferChanges(readSinkTransferChanges(blockEvents ?? []), currentBlock.height, dbTransaction);
  }

  /** End-block totals follow the block's transactions and replace their snapshot, while begin-block totals precede them and only fill a block no transaction wrote. */
  private async saveBlockLevelTotals(blockEvents: EventType[], height: number, dbTransaction: DbTransaction): Promise<void> {
    const { beforeTransactions, afterTransactions } = findBlockLevelSinkTotalsEvents(blockEvents);
    const totalsEvent = afterTransactions ?? beforeTransactions;
    if (!totalsEvent) return;

    const totals = parseSinkTotals(totalsEvent.attributes);
    if (!totals) {
      this.logger.warn({ event: "SINK_TOTALS_EVENT_MALFORMED", height });
      return;
    }

    const snapshot = { height, ...totals };
    if (afterTransactions) {
      await SinkTotalsSnapshot.upsert(snapshot, { transaction: dbTransaction });
    } else {
      await SinkTotalsSnapshot.bulkCreate([snapshot], { ignoreDuplicates: true, transaction: dbTransaction });
    }
  }

  /** Totals are absolute, so the last event of a block's last sink transaction wins and reprocessing a block rewrites the same row. */
  async afterEveryTransaction(
    _rawTx: DecodedTxRaw,
    currentTransaction: Transaction,
    dbTransaction: DbTransaction,
    txEvents: TransactionEvent[]
  ): Promise<void> {
    if (currentTransaction.hasProcessingError) return;

    await this.saveTransactionTotals(currentTransaction, dbTransaction, txEvents);

    await this.saveTransferChanges(readSinkTransferChanges(txEvents), currentTransaction.height, dbTransaction);
  }

  private async saveTransactionTotals(currentTransaction: Transaction, dbTransaction: DbTransaction, txEvents: TransactionEvent[]): Promise<void> {
    const totalsEvent = findLastSinkTotalsEvent(txEvents);
    if (!totalsEvent) return;

    const totals = parseSinkTotals(totalsEvent.attributes ?? []);
    if (!totals) {
      this.logger.warn({ event: "SINK_TOTALS_EVENT_MALFORMED", height: currentTransaction.height, transactionId: currentTransaction.id });
      return;
    }

    await SinkTotalsSnapshot.upsert({ height: currentTransaction.height, ...totals }, { transaction: dbTransaction });
  }

  private async saveTransferChanges(changes: SinkTransferChange[], height: number, dbTransaction: DbTransaction): Promise<void> {
    for (const change of changes) {
      if (change.kind === "malformed") {
        this.logger.warn({ event: "SINK_TRANSFER_EVENT_MALFORMED", height, eventType: change.eventType });
      } else if (change.kind === "created") {
        await this.createTransfer(change, height, dbTransaction);
      } else {
        await this.changeTransferStatus(change, height, dbTransaction);
      }
    }
  }

  /** Reprocessing a block starts its transfers over as pending, since the block's later events are replayed after it. */
  private async createTransfer(creation: SinkTransferCreation, height: number, dbTransaction: DbTransaction): Promise<void> {
    await SinkTransfer.upsert(
      {
        ...creation.key,
        owner: creation.owner,
        recipient: creation.recipient,
        amount: creation.amount,
        status: "pending" satisfies SinkTransferStatus,
        hasVoidOrder: false,
        statusHeight: height
      },
      { transaction: dbTransaction }
    );
  }

  private async changeTransferStatus(change: SinkTransferStatusChange, height: number, dbTransaction: DbTransaction): Promise<void> {
    const transfer = await SinkTransfer.findOne({ where: change.key, transaction: dbTransaction });
    if (!transfer) {
      this.logger.warn({ event: "SINK_TRANSFER_NOT_FOUND", height, change: change.kind, transfer: change.key });
      return;
    }

    const current = { status: transfer.status as SinkTransferStatus, hasVoidOrder: transfer.hasVoidOrder };
    const next = applySinkTransferChange(current, change);
    if (next.status === current.status && next.hasVoidOrder === current.hasVoidOrder) return;

    await SinkTransfer.update(
      { ...next, statusHeight: next.status === current.status ? transfer.statusHeight : height },
      { where: change.key, transaction: dbTransaction }
    );
  }
}
