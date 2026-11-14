import { StakingUnbonding } from "@akashnetwork/database/dbSchemas/akash";
import type { Transaction, TransactionEvent } from "@akashnetwork/database/dbSchemas/base";
import { LoggerService } from "@akashnetwork/logging";
import type { DecodedTxRaw } from "@cosmjs/proto-signing";
import type { Transaction as DbTransaction } from "sequelize";

import * as benchmark from "@src/shared/utils/benchmark";
import { Indexer } from "./indexer";
import { readStakingUnbondings } from "./stakingUnbonding.helpers";

export class StakingUnbondingIndexer extends Indexer {
  constructor(private readonly logger = LoggerService.forContext("StakingUnbondingIndexer")) {
    super();
    this.name = "StakingUnbondingIndexer";
    this.processFailedTxs = false;
    this.msgHandlers = {};
  }

  @benchmark.measureMethodAsync
  async dropTables(): Promise<void> {
    await StakingUnbonding.drop({ cascade: true });
  }

  async createTables(): Promise<void> {
    await StakingUnbonding.sync({ force: false });
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

  /** Reads events rather than messages so unbondings sent through authz are counted, and upserts so reprocessing a block rewrites the same rows. */
  async afterEveryTransaction(
    _rawTx: DecodedTxRaw,
    currentTransaction: Transaction,
    dbTransaction: DbTransaction,
    txEvents: TransactionEvent[]
  ): Promise<void> {
    if (currentTransaction.hasProcessingError) return;

    for (const change of readStakingUnbondings(txEvents)) {
      if (change.kind === "malformed") {
        this.logger.warn({ event: "STAKING_UNBONDING_EVENT_MALFORMED", height: currentTransaction.height, eventType: change.eventType });
        continue;
      }

      await StakingUnbonding.upsert({ ...change.record, height: currentTransaction.height }, { transaction: dbTransaction });
    }
  }
}
