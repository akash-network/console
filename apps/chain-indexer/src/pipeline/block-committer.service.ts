import { inArray } from "drizzle-orm";
import { inject, singleton } from "tsyringe";

import { Blocks, IndexerState, Messages, MessageTypes, Transactions } from "@src/db/schema";
import type { DecodedBlock } from "@src/pipeline/decoded-block";
import type { ChainDatabase } from "@src/providers/db.provider";
import { CHAIN_DB } from "@src/providers/db.provider";

export const SYNC_STREAM = "sync";

@singleton()
export class BlockCommitterService {
  readonly #db: ChainDatabase;
  readonly #typeIds = new Map<string, number>();

  constructor(@inject(CHAIN_DB) db: ChainDatabase) {
    this.#db = db;
  }

  async commit(block: DecodedBlock): Promise<void> {
    const typeIds = await this.#internMessageTypes(block);

    const transactionRows = block.transactions.map(tx => ({
      height: block.height,
      index: tx.index,
      hash: tx.hash,
      code: tx.code,
      gasUsed: tx.gasUsed,
      gasWanted: tx.gasWanted,
      fee: tx.fee
    }));

    const messageRows = block.transactions.flatMap(tx =>
      tx.messages.map(message => ({
        height: block.height,
        txIndex: tx.index,
        index: message.index,
        typeId: typeIds.get(message.typeUrl) as number,
        body: message.body
      }))
    );

    await this.#db.transaction(async tx => {
      await tx
        .insert(Blocks)
        .values({
          height: block.height,
          datetime: block.datetime,
          hash: block.hash,
          parentHash: block.parentHash,
          proposerAddress: block.proposerAddress,
          txCount: block.transactions.length
        })
        .onConflictDoNothing();

      if (transactionRows.length > 0) {
        await tx.insert(Transactions).values(transactionRows).onConflictDoNothing();
      }

      if (messageRows.length > 0) {
        await tx.insert(Messages).values(messageRows).onConflictDoNothing();
      }

      await tx
        .insert(IndexerState)
        .values({ stream: SYNC_STREAM, lastHeight: block.height, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: IndexerState.stream,
          set: { lastHeight: block.height, updatedAt: new Date() }
        });
    });
  }

  async #internMessageTypes(block: DecodedBlock): Promise<Map<string, number>> {
    const typeUrls = new Set(block.transactions.flatMap(tx => tx.messages.map(message => message.typeUrl)));
    const missing = [...typeUrls].filter(typeUrl => !this.#typeIds.has(typeUrl));

    if (missing.length > 0) {
      await this.#db
        .insert(MessageTypes)
        .values(missing.map(type => ({ type })))
        .onConflictDoNothing();

      const rows = await this.#db.select().from(MessageTypes).where(inArray(MessageTypes.type, missing));
      rows.forEach(row => this.#typeIds.set(row.type, row.id));
    }

    return this.#typeIds;
  }
}
