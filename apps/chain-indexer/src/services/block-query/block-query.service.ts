import { asc, desc, eq } from "drizzle-orm";
import { inject, singleton } from "tsyringe";

import { Blocks, Messages, MessageTypes, Transactions, Validators } from "@src/db/schema";
import type { BlockSummary, GetBlockResponse } from "@src/http-schemas/blocks.schema";
import type { ChainDatabase } from "@src/providers/db.provider";
import { CHAIN_DB } from "@src/providers/db.provider";
import { groupMessagesByTransaction, toBlockTransaction, toHex } from "@src/services/transaction-mapping/transaction-mapping";

interface BlockRow {
  block: typeof Blocks.$inferSelect;
  operatorAddress: string | null;
  moniker: string | null;
}

/** Read side of `cosmos.blocks`: the latest blocks walk the primary key backwards, and a block by height is one key lookup plus its transactions by key prefix. */
@singleton()
export class BlockQueryService {
  readonly #db: ChainDatabase;

  constructor(@inject(CHAIN_DB) db: ChainDatabase) {
    this.#db = db;
  }

  async listLatest(limit: number): Promise<BlockSummary[]> {
    const rows = await this.#db
      .select({ block: Blocks, operatorAddress: Validators.operatorAddress, moniker: Validators.moniker })
      .from(Blocks)
      .leftJoin(Validators, eq(Validators.hexAddress, Blocks.proposerAddress))
      .orderBy(desc(Blocks.height))
      .limit(limit);

    return rows.map(toSummary);
  }

  async getByHeight(height: number): Promise<GetBlockResponse["data"] | null> {
    const [row] = await this.#db
      .select({ block: Blocks, operatorAddress: Validators.operatorAddress, moniker: Validators.moniker })
      .from(Blocks)
      .leftJoin(Validators, eq(Validators.hexAddress, Blocks.proposerAddress))
      .where(eq(Blocks.height, height));

    if (!row) {
      return null;
    }

    const [transactions, messages] = await Promise.all([
      this.#db.select().from(Transactions).where(eq(Transactions.height, height)).orderBy(asc(Transactions.index)),
      this.#db
        .select({ txIndex: Messages.txIndex, index: Messages.index, type: MessageTypes.type })
        .from(Messages)
        .innerJoin(MessageTypes, eq(Messages.typeId, MessageTypes.id))
        .where(eq(Messages.height, height))
        .orderBy(asc(Messages.txIndex), asc(Messages.index))
    ]);
    const messagesByTransaction = groupMessagesByTransaction(messages);

    return {
      ...toSummary(row),
      parentHash: row.block.parentHash ? toHex(row.block.parentHash) : null,
      transactions: transactions.map(transaction => toBlockTransaction(transaction, messagesByTransaction.get(transaction.index) ?? []))
    };
  }
}

function toSummary(row: BlockRow): BlockSummary {
  return {
    height: row.block.height,
    datetime: row.block.datetime.toISOString(),
    hash: toHex(row.block.hash),
    proposer: { address: row.block.proposerAddress, operatorAddress: row.operatorAddress, moniker: row.moniker },
    transactionCount: row.block.txCount
  };
}
