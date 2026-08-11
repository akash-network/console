import { inArray } from "drizzle-orm";
import { inject, singleton } from "tsyringe";

import { Blocks, IndexerState, Messages, MessageTypes, Transactions } from "@src/db/schema";
import type { DecodedBlock } from "@src/pipeline/decoded-block";
import type { ChainDatabase } from "@src/providers/db.provider";
import { CHAIN_DB } from "@src/providers/db.provider";

export const SYNC_STREAM = "sync";

/** Keeps multi-row inserts well under postgres.js's ~65k bind-parameter limit when batches span hundreds of blocks. */
const INSERT_CHUNK_SIZE = 2_000;

@singleton()
export class BlockCommitterService {
  readonly #db: ChainDatabase;
  readonly #typeIds = new Map<string, number>();

  constructor(@inject(CHAIN_DB) db: ChainDatabase) {
    this.#db = db;
  }

  async commit(block: DecodedBlock): Promise<void> {
    await this.commitBatch([block], { stream: SYNC_STREAM });
  }

  /** Commits contiguous blocks and the checkpoint advance in one transaction, so the checkpoint never points past uncommitted data. */
  async commitBatch(blocks: DecodedBlock[], options: { stream: string }): Promise<void> {
    if (blocks.length === 0) {
      return;
    }

    this.#verifyContiguous(blocks);
    const typeIds = await this.#internMessageTypes(blocks);

    const blockRows = blocks.map(block => ({
      height: block.height,
      datetime: block.datetime,
      hash: block.hash,
      parentHash: block.parentHash,
      proposerAddress: block.proposerAddress,
      txCount: block.transactions.length
    }));

    const transactionRows = blocks.flatMap(block =>
      block.transactions.map(tx => ({
        height: block.height,
        index: tx.index,
        hash: tx.hash,
        code: tx.code,
        gasUsed: tx.gasUsed,
        gasWanted: tx.gasWanted,
        fee: tx.fee
      }))
    );

    const messageRows = blocks.flatMap(block =>
      block.transactions.flatMap(tx =>
        tx.messages.map(message => ({
          height: block.height,
          txIndex: tx.index,
          index: message.index,
          typeId: typeIds.get(message.typeUrl) as number,
          body: message.body
        }))
      )
    );

    const lastHeight = blocks[blocks.length - 1].height;

    await this.#db.transaction(async tx => {
      for (const chunk of chunked(blockRows, INSERT_CHUNK_SIZE)) {
        await tx.insert(Blocks).values(chunk).onConflictDoNothing();
      }

      for (const chunk of chunked(transactionRows, INSERT_CHUNK_SIZE)) {
        await tx.insert(Transactions).values(chunk).onConflictDoNothing();
      }

      for (const chunk of chunked(messageRows, INSERT_CHUNK_SIZE)) {
        await tx.insert(Messages).values(chunk).onConflictDoNothing();
      }

      await tx
        .insert(IndexerState)
        .values({ stream: options.stream, lastHeight, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: IndexerState.stream,
          set: { lastHeight, updatedAt: new Date() }
        });
    });
  }

  /** The checkpoint advances to the batch's last height, which is only correct when the batch has no gaps or reordering. */
  #verifyContiguous(blocks: DecodedBlock[]): void {
    blocks.forEach((block, index) => {
      const expectedHeight = blocks[0].height + index;

      if (block.height !== expectedHeight) {
        throw new Error(`Non-contiguous batch: expected height ${expectedHeight} at position ${index}, got ${block.height}`);
      }
    });
  }

  async #internMessageTypes(blocks: DecodedBlock[]): Promise<Map<string, number>> {
    const typeUrls = new Set(blocks.flatMap(block => block.transactions.flatMap(tx => tx.messages.map(message => message.typeUrl))));
    const uncached = [...typeUrls].filter(typeUrl => !this.#typeIds.has(typeUrl));

    if (uncached.length > 0) {
      await this.#cacheTypeIds(uncached);
    }

    return this.#typeIds;
  }

  /** Existing rows are selected before inserting: an insert that conflicts still consumes the id sequence, which would exhaust it across restarts. */
  async #cacheTypeIds(uncached: string[]): Promise<void> {
    const existing = await this.#db.select().from(MessageTypes).where(inArray(MessageTypes.type, uncached));
    existing.forEach(row => this.#typeIds.set(row.type, row.id));

    const missing = uncached.filter(typeUrl => !this.#typeIds.has(typeUrl));

    if (missing.length === 0) {
      return;
    }

    const inserted = await this.#db
      .insert(MessageTypes)
      .values(missing.map(type => ({ type })))
      .onConflictDoNothing()
      .returning();
    inserted.forEach(row => this.#typeIds.set(row.type, row.id));

    const insertedConcurrently = missing.filter(typeUrl => !this.#typeIds.has(typeUrl));

    if (insertedConcurrently.length > 0) {
      const rows = await this.#db.select().from(MessageTypes).where(inArray(MessageTypes.type, insertedConcurrently));
      rows.forEach(row => this.#typeIds.set(row.type, row.id));
    }
  }
}

function chunked<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let start = 0; start < rows.length; start += size) {
    chunks.push(rows.slice(start, start + size));
  }

  return chunks;
}
