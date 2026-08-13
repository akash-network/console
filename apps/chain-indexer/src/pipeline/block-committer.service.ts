import { inArray, sql } from "drizzle-orm";
import { inject, singleton } from "tsyringe";

import { insertChunked } from "@src/db/insert-chunked";
import { AccountTxs, Blocks, IndexerState, Messages, MessageTypes, Transactions } from "@src/db/schema";
import { GovWriter } from "@src/gov/gov-writer.service";
import { AccountInterner } from "@src/pipeline/balance/account-interner.service";
import type { DerivedAccountTx } from "@src/pipeline/balance/account-tx-deriver";
import { deriveAccountTxs } from "@src/pipeline/balance/account-tx-deriver";
import type { DerivedBalanceChange } from "@src/pipeline/balance/balance-deriver";
import { deriveBalanceChanges } from "@src/pipeline/balance/balance-deriver";
import type { ResolvedBalanceChange } from "@src/pipeline/balance/balance-writer.service";
import { BalanceWriter } from "@src/pipeline/balance/balance-writer.service";
import { buildModuleAddressRegistry } from "@src/pipeline/balance/module-address-registry";
import type { DecodedBlock } from "@src/pipeline/decoded-block";
import type { ChainDatabase } from "@src/providers/db.provider";
import { CHAIN_DB } from "@src/providers/db.provider";

export const SYNC_STREAM = "sync";

@singleton()
export class BlockCommitterService {
  readonly #db: ChainDatabase;
  readonly #interner: AccountInterner;
  readonly #balanceWriter: BalanceWriter;
  readonly #govWriter: GovWriter;
  readonly #moduleRegistry = buildModuleAddressRegistry();
  readonly #typeIds = new Map<string, number>();

  constructor(
    @inject(CHAIN_DB) db: ChainDatabase,
    @inject(AccountInterner) interner: AccountInterner,
    @inject(BalanceWriter) balanceWriter: BalanceWriter,
    @inject(GovWriter) govWriter: GovWriter
  ) {
    this.#db = db;
    this.#interner = interner;
    this.#balanceWriter = balanceWriter;
    this.#govWriter = govWriter;
  }

  async commit(block: DecodedBlock): Promise<void> {
    await this.commitBatch([block], { stream: SYNC_STREAM });
  }

  /**
   * Commits contiguous blocks and the checkpoint advance in one transaction, so the checkpoint
   * never points past uncommitted data. Inserts are conflict-ignoring and the checkpoint only
   * moves forward, so concurrent writers on the same stream (e.g. two pods overlapping during a
   * rolling deploy) duplicate work but cannot corrupt data or regress the checkpoint.
   */
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

    const balanceChanges = blocks.flatMap(block => deriveBalanceChanges(block, this.#moduleRegistry));
    const accountTxs = blocks.flatMap(block => deriveAccountTxs(block));
    const accountIds = await this.#internAccounts(balanceChanges, accountTxs);
    const balanceIntents = this.#resolveBalanceChanges(balanceChanges, accountIds);
    const accountTxRows = this.#resolveAccountTxs(accountTxs, accountIds);

    const lastHeight = blocks[blocks.length - 1].height;

    await this.#db.transaction(async tx => {
      await insertChunked(tx, Blocks, blockRows);
      await insertChunked(tx, Transactions, transactionRows);
      await insertChunked(tx, Messages, messageRows);

      await this.#balanceWriter.write(tx, balanceIntents);
      await insertChunked(tx, AccountTxs, accountTxRows);
      await this.#govWriter.writeForBlocks(tx, blocks, accountIds);

      await tx
        .insert(IndexerState)
        .values({ stream: options.stream, lastHeight, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: IndexerState.stream,
          set: { lastHeight: sql`GREATEST(${IndexerState.lastHeight}, EXCLUDED.last_height)`, updatedAt: new Date() }
        });
    });
  }

  /** The checkpoint advances to the batch's last height, which is only correct when the batch has no gaps or reordering. */
  #verifyContiguous(blocks: DecodedBlock[]): void {
    const baseHeight = blocks[0].height;

    blocks.forEach((block, index) => {
      const expectedHeight = baseHeight + index;

      if (block.height !== expectedHeight) {
        throw new Error(`Non-contiguous batch: expected height ${expectedHeight} at position ${index}, got ${block.height}`);
      }
    });
  }

  /**
   * Interns every address the batch touches — spenders, receivers, correlated counterparties and tx signers —
   * on the base connection before the commit transaction, so the ledger and activity rows can reference their
   * account ids by foreign key.
   */
  async #internAccounts(balanceChanges: DerivedBalanceChange[], accountTxs: DerivedAccountTx[]): Promise<Map<string, number>> {
    const addresses = new Set<string>();

    for (const change of balanceChanges) {
      addresses.add(change.address);
      if (change.counterpartyAddress) {
        addresses.add(change.counterpartyAddress);
      }
    }
    for (const row of accountTxs) {
      addresses.add(row.address);
    }

    return this.#interner.resolve(addresses);
  }

  #resolveBalanceChanges(changes: DerivedBalanceChange[], accountIds: Map<string, number>): ResolvedBalanceChange[] {
    return changes.map(change => ({
      accountId: this.#requireId(accountIds, change.address),
      counterpartyAccountId: change.counterpartyAddress ? accountIds.get(change.counterpartyAddress) ?? null : null,
      denom: change.denom,
      delta: change.delta,
      reason: change.reason,
      height: change.height,
      txIndex: change.txIndex,
      eventIndex: change.eventIndex
    }));
  }

  #resolveAccountTxs(rows: DerivedAccountTx[], accountIds: Map<string, number>): (typeof AccountTxs.$inferInsert)[] {
    return rows.map(row => ({ accountId: this.#requireId(accountIds, row.address), height: row.height, txIndex: row.txIndex, role: row.role }));
  }

  #requireId(accountIds: Map<string, number>, address: string): number {
    const accountId = accountIds.get(address);
    if (accountId === undefined) {
      throw new Error(`No interned account id for address ${address}`);
    }
    return accountId;
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
