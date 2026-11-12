import { SinkTotalsSnapshot } from "@akashnetwork/database/dbSchemas/akash";
import type { Block, Transaction, TransactionEvent } from "@akashnetwork/database/dbSchemas/base";
import { LoggerService } from "@akashnetwork/logging";
import type { DecodedTxRaw } from "@cosmjs/proto-signing";
import type { Transaction as DbTransaction } from "sequelize";

import type { BlockResultsReader } from "@src/chain/blockResultsReader";
import * as benchmark from "@src/shared/utils/benchmark";
import { Indexer } from "./indexer";
import { findBlockLevelSinkTotalsEvents, findLastSinkTotalsEvent, parseSinkTotals } from "./sinkIndexer.helpers";

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
  }

  async createTables(): Promise<void> {
    await SinkTotalsSnapshot.sync({ force: false });
  }

  initCache(): Promise<void> {
    return Promise.resolve();
  }

  seed(): Promise<void> {
    return Promise.resolve();
  }

  /** End-block totals follow the block's transactions and replace their snapshot, while begin-block totals precede them and only fill a block no transaction wrote. */
  async afterEveryBlock(currentBlock: Block, _previousBlock: Block | null, dbTransaction: DbTransaction): Promise<void> {
    const { finalize_block_events: blockEvents } = await this.readBlockResults(currentBlock.height);
    const { beforeTransactions, afterTransactions } = findBlockLevelSinkTotalsEvents(blockEvents ?? []);
    const totalsEvent = afterTransactions ?? beforeTransactions;
    if (!totalsEvent) return;

    const totals = parseSinkTotals(totalsEvent.attributes);
    if (!totals) {
      this.logger.warn({ event: "SINK_TOTALS_EVENT_MALFORMED", height: currentBlock.height });
      return;
    }

    const snapshot = { height: currentBlock.height, ...totals };
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

    const totalsEvent = findLastSinkTotalsEvent(txEvents);
    if (!totalsEvent) return;

    const totals = parseSinkTotals(totalsEvent.attributes ?? []);
    if (!totals) {
      this.logger.warn({ event: "SINK_TOTALS_EVENT_MALFORMED", height: currentTransaction.height, transactionId: currentTransaction.id });
      return;
    }

    await SinkTotalsSnapshot.upsert({ height: currentTransaction.height, ...totals }, { transaction: dbTransaction });
  }
}
