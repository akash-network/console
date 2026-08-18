import { and, between, inArray, isNull, sql } from "drizzle-orm";
import chunk from "lodash/chunk";
import { inject, singleton } from "tsyringe";

import type { AkashBlockChanges } from "@src/akash/akash-changes";
import { collectAkashAddresses } from "@src/akash/akash-changes";
import { deriveAkashChanges } from "@src/akash/akash-deriver";
import { AkashWriter } from "@src/akash/akash-writer.service";
import { ProviderWriter } from "@src/akash/provider-writer.service";
import type { BmeBlockChanges } from "@src/bme/bme-deriver";
import { collectBmeAddresses, deriveBmeChanges } from "@src/bme/bme-deriver";
import { BmeWriter } from "@src/bme/bme-writer.service";
import { INSERT_CHUNK_SIZE } from "@src/db/insert-chunk-size";
import { insertChunked } from "@src/db/insert-chunked";
import { AccountTxs, Blocks, IndexerState, MessageDeadLetters, Messages, MessageTypes, Transactions } from "@src/db/schema";
import { sqlExcluded } from "@src/db/sql-excluded";
import { GovWriter } from "@src/gov/gov-writer.service";
import { NetworkStatsWriter } from "@src/network/network-stats-writer.service";
import { AccountInterner, requireAccountId } from "@src/pipeline/balance/account-interner.service";
import type { DerivedAccountTx } from "@src/pipeline/balance/account-tx-deriver";
import { deriveAccountTxs } from "@src/pipeline/balance/account-tx-deriver";
import type { DerivedBalanceChange } from "@src/pipeline/balance/balance-deriver";
import { deriveBalanceChanges } from "@src/pipeline/balance/balance-deriver";
import type { ResolvedBalanceChange } from "@src/pipeline/balance/balance-writer.service";
import { BalanceWriter } from "@src/pipeline/balance/balance-writer.service";
import { buildModuleAddressRegistry } from "@src/pipeline/balance/module-address-registry";
import type { DecodedBlock, MessageDecodeFailure } from "@src/pipeline/decoded-block";
import type { ChainDatabase, ChainTransaction } from "@src/providers/db.provider";
import { CHAIN_DB } from "@src/providers/db.provider";
import { LoggerService } from "@src/providers/logging.provider";

export const SYNC_STREAM = "sync";

function countByTypeUrl(messages: ReadonlyArray<{ typeUrl: string }>): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const message of messages) {
    counts[message.typeUrl] = (counts[message.typeUrl] ?? 0) + 1;
  }

  return counts;
}

function messageCoordKey(row: { height: number; txIndex: number; index: number }): string {
  return `${row.height}:${row.txIndex}:${row.index}`;
}

@singleton()
export class BlockCommitterService {
  readonly #db: ChainDatabase;
  readonly #interner: AccountInterner;
  readonly #balanceWriter: BalanceWriter;
  readonly #govWriter: GovWriter;
  readonly #akashWriter: AkashWriter;
  readonly #providerWriter: ProviderWriter;
  readonly #bmeWriter: BmeWriter;
  readonly #networkStatsWriter: NetworkStatsWriter;
  readonly #logger: LoggerService;
  readonly #moduleRegistry = buildModuleAddressRegistry();
  readonly #typeIds = new Map<string, number>();

  constructor(
    @inject(CHAIN_DB) db: ChainDatabase,
    @inject(AccountInterner) interner: AccountInterner,
    @inject(BalanceWriter) balanceWriter: BalanceWriter,
    @inject(GovWriter) govWriter: GovWriter,
    @inject(AkashWriter) akashWriter: AkashWriter,
    @inject(ProviderWriter) providerWriter: ProviderWriter,
    @inject(BmeWriter) bmeWriter: BmeWriter,
    @inject(NetworkStatsWriter) networkStatsWriter: NetworkStatsWriter,
    @inject(LoggerService) logger: LoggerService
  ) {
    this.#db = db;
    this.#interner = interner;
    this.#balanceWriter = balanceWriter;
    this.#govWriter = govWriter;
    this.#akashWriter = akashWriter;
    this.#providerWriter = providerWriter;
    this.#bmeWriter = bmeWriter;
    this.#networkStatsWriter = networkStatsWriter;
    this.#logger = logger;
    this.#logger.setContext("COMMITTER");
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

    const deadLetteredMessages = blocks.flatMap(block =>
      block.transactions.flatMap(tx =>
        tx.messages.flatMap(message =>
          message.decodeFailure
            ? [{ height: block.height, txIndex: tx.index, index: message.index, typeUrl: message.typeUrl, failure: message.decodeFailure }]
            : []
        )
      )
    );

    const balanceChanges = blocks.flatMap(block => deriveBalanceChanges(block, this.#moduleRegistry));
    const accountTxs = blocks.flatMap(block => deriveAccountTxs(block));
    const akashChanges = blocks.map(block => deriveAkashChanges(block));
    const bmeChanges = blocks.map(block => deriveBmeChanges(block));
    const accountIds = await this.#internAccounts(balanceChanges, accountTxs, akashChanges, bmeChanges);
    const balanceIntents = this.#resolveBalanceChanges(balanceChanges, accountIds);
    const accountTxRows = this.#resolveAccountTxs(accountTxs, accountIds);

    const lastHeight = blocks[blocks.length - 1].height;

    const persistedDeadLetters = await this.#db.transaction(async tx => {
      await insertChunked(tx, Blocks, blockRows);
      await insertChunked(tx, Transactions, transactionRows);
      await this.#upsertMessages(tx, messageRows);
      const persisted = await this.#replaceDeadLetters(tx, blocks[0].height, lastHeight, deadLetteredMessages, typeIds);

      await this.#balanceWriter.write(tx, balanceIntents);
      await insertChunked(tx, AccountTxs, accountTxRows);
      await this.#govWriter.writeForBlocks(tx, blocks, accountIds);
      const { networkDeltas } = await this.#akashWriter.write(tx, akashChanges, accountIds);
      await this.#providerWriter.write(tx, akashChanges, accountIds);
      await this.#bmeWriter.write(tx, bmeChanges, accountIds);
      await this.#networkStatsWriter.write(tx, blocks, networkDeltas);

      await tx
        .insert(IndexerState)
        .values({ stream: options.stream, lastHeight, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: IndexerState.stream,
          set: { lastHeight: sql`GREATEST(${IndexerState.lastHeight}, EXCLUDED.last_height)`, updatedAt: new Date() }
        });

      return persisted;
    });

    if (persistedDeadLetters.length > 0) {
      this.#logger.error({
        event: "MESSAGES_DEAD_LETTERED",
        stream: options.stream,
        count: persistedDeadLetters.length,
        byType: countByTypeUrl(persistedDeadLetters),
        fromHeight: blocks[0].height,
        toHeight: lastHeight
      });
    }
  }

  /**
   * Range-delete, then insert only for messages whose body is still null after the upsert. A writer
   * with a stale type catalog can still fail to decode a message another writer already healed; without
   * this check it would put a phantom dead-letter row back and fire MESSAGES_DEAD_LETTERED.
   */
  async #replaceDeadLetters(
    tx: ChainTransaction,
    fromHeight: number,
    toHeight: number,
    deadLetteredMessages: ReadonlyArray<{
      height: number;
      txIndex: number;
      index: number;
      typeUrl: string;
      failure: MessageDecodeFailure;
    }>,
    typeIds: Map<string, number>
  ): Promise<typeof deadLetteredMessages> {
    await tx.delete(MessageDeadLetters).where(between(MessageDeadLetters.height, fromHeight, toHeight));

    if (deadLetteredMessages.length === 0) {
      return [];
    }

    const nullBodies = await tx
      .select({ height: Messages.height, txIndex: Messages.txIndex, index: Messages.index })
      .from(Messages)
      .where(and(between(Messages.height, fromHeight, toHeight), isNull(Messages.body)));
    const nullKeys = new Set(nullBodies.map(row => messageCoordKey(row)));
    const persisted = deadLetteredMessages.filter(message => nullKeys.has(messageCoordKey(message)));

    await insertChunked(
      tx,
      MessageDeadLetters,
      persisted.map(message => ({
        height: message.height,
        txIndex: message.txIndex,
        index: message.index,
        typeId: typeIds.get(message.typeUrl) as number,
        raw: Buffer.from(message.failure.raw),
        error: message.failure.error
      }))
    );

    return persisted;
  }

  /**
   * Conflicting rows only get their body updated when it was null and the new decode produced one,
   * so replaying a range after registering a previously unknown type heals the dead-lettered rows
   * while normal re-commits stay write-free.
   */
  async #upsertMessages(tx: ChainTransaction, rows: (typeof Messages.$inferInsert)[]): Promise<void> {
    for (const rowChunk of chunk(rows, INSERT_CHUNK_SIZE)) {
      await tx
        .insert(Messages)
        .values(rowChunk)
        .onConflictDoUpdate({
          target: [Messages.height, Messages.txIndex, Messages.index],
          set: { body: sqlExcluded("body") },
          setWhere: sql`${Messages.body} IS NULL AND excluded.body IS NOT NULL`
        });
    }
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
   * Interns every address the batch touches — spenders, receivers, correlated counterparties, tx signers,
   * the deployment owners/providers/depositors of the akash changes and the parties of the bme changes —
   * on the base connection before the commit transaction, so the derived rows can reference their
   * account ids by foreign key.
   */
  async #internAccounts(
    balanceChanges: DerivedBalanceChange[],
    accountTxs: DerivedAccountTx[],
    akashChanges: AkashBlockChanges[],
    bmeChanges: BmeBlockChanges[]
  ): Promise<Map<string, number>> {
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
    for (const address of collectAkashAddresses(akashChanges)) {
      addresses.add(address);
    }
    for (const address of collectBmeAddresses(bmeChanges)) {
      addresses.add(address);
    }

    return this.#interner.resolve(addresses);
  }

  #resolveBalanceChanges(changes: DerivedBalanceChange[], accountIds: Map<string, number>): ResolvedBalanceChange[] {
    return changes.map(change => ({
      accountId: requireAccountId(accountIds, change.address),
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
    return rows.map(row => ({ accountId: requireAccountId(accountIds, row.address), height: row.height, txIndex: row.txIndex, role: row.role }));
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
