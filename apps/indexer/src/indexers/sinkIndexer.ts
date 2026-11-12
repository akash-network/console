import { SinkTotalsSnapshot } from "@akashnetwork/database/dbSchemas/akash";
import type { Transaction, TransactionEvent } from "@akashnetwork/database/dbSchemas/base";
import { LoggerService } from "@akashnetwork/logging";
import type { DecodedTxRaw } from "@cosmjs/proto-signing";
import type { Transaction as DbTransaction } from "sequelize";

import * as benchmark from "@src/shared/utils/benchmark";
import { Indexer } from "./indexer";
import { findLastSinkTotalsEvent, parseSinkTotals } from "./sinkIndexer.helpers";

export class SinkIndexer extends Indexer {
  constructor(private readonly logger = LoggerService.forContext("SinkIndexer")) {
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

  afterEveryBlock(): Promise<void> {
    return Promise.resolve();
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
