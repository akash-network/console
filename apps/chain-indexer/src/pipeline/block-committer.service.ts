import { and, between, eq, inArray, isNull, sql } from "drizzle-orm";
import { inject, singleton } from "tsyringe";

import type { AkashBlockChanges } from "@src/akash/akash-changes";
import { collectAkashAddresses } from "@src/akash/akash-changes";
import { deriveAkashChanges } from "@src/akash/akash-deriver";
import { AkashWriter } from "@src/akash/akash-writer.service";
import { ProviderWriter } from "@src/akash/provider-writer.service";
import type { ActMigrationOutcome, ActMigrationSegment } from "@src/bme/act-migration.service";
import { ActMigrationService } from "@src/bme/act-migration.service";
import type { BmeBlockChanges } from "@src/bme/bme-deriver";
import { collectBmeAddresses, deriveBmeChanges } from "@src/bme/bme-deriver";
import { BmeWriter } from "@src/bme/bme-writer.service";
import { BulkInserter } from "@src/db/bulk-inserter.service";
import { AccountTxs, Blocks, IndexerState, MessageDeadLetters, Messages, MessageTypes, Transactions } from "@src/db/schema";
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
import { advanceCheckpoint } from "@src/pipeline/checkpoint";
import type { DecodedBlock, MessageDecodeFailure } from "@src/pipeline/decoded-block";
import { readModulesUnderReplay } from "@src/pipeline/module-replay/replay-markers";
import type { ReplayableModule } from "@src/pipeline/modules";
import { REPLAY_HANDOFF_LOCK_KEY } from "@src/pipeline/modules";
import type { ChainDatabase, ChainTransaction } from "@src/providers/db.provider";
import { CHAIN_DB } from "@src/providers/db.provider";
import { LoggerService } from "@src/providers/logging.provider";

export const SYNC_STREAM = "sync";

export interface CommitOptions {
  stream: string;
  /** Restricts the commit to these modules' writers (a module replay); the core tables and every other module are untouched. */
  modules?: ReadonlySet<ReplayableModule>;
  /** A module replay's final batch: under the handoff lock, the replay marker comes off when sync's checkpoint is exactly the batch end. */
  handoff?: boolean;
}

export interface CommitResult {
  /** Modules a full commit left to an in-progress replay. */
  modulesSkipped: ReplayableModule[];
  handoffCompleted: boolean;
}

interface SegmentOutcome extends CommitResult {
  persistedDeadLetters: ReadonlyArray<{ typeUrl: string }>;
  migrationOutcome: ActMigrationOutcome | null;
  akashWritten: boolean;
}

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
  readonly #bulkInserter: BulkInserter;
  readonly #interner: AccountInterner;
  readonly #balanceWriter: BalanceWriter;
  readonly #govWriter: GovWriter;
  readonly #akashWriter: AkashWriter;
  readonly #providerWriter: ProviderWriter;
  readonly #bmeWriter: BmeWriter;
  readonly #networkStatsWriter: NetworkStatsWriter;
  readonly #actMigration: ActMigrationService;
  readonly #logger: LoggerService;
  readonly #moduleRegistry = buildModuleAddressRegistry();
  readonly #typeIds = new Map<string, number>();

  constructor(
    @inject(CHAIN_DB) db: ChainDatabase,
    @inject(BulkInserter) bulkInserter: BulkInserter,
    @inject(AccountInterner) interner: AccountInterner,
    @inject(BalanceWriter) balanceWriter: BalanceWriter,
    @inject(GovWriter) govWriter: GovWriter,
    @inject(AkashWriter) akashWriter: AkashWriter,
    @inject(ProviderWriter) providerWriter: ProviderWriter,
    @inject(BmeWriter) bmeWriter: BmeWriter,
    @inject(NetworkStatsWriter) networkStatsWriter: NetworkStatsWriter,
    @inject(ActMigrationService) actMigration: ActMigrationService,
    @inject(LoggerService) logger: LoggerService
  ) {
    this.#db = db;
    this.#bulkInserter = bulkInserter;
    this.#interner = interner;
    this.#balanceWriter = balanceWriter;
    this.#govWriter = govWriter;
    this.#akashWriter = akashWriter;
    this.#providerWriter = providerWriter;
    this.#bmeWriter = bmeWriter;
    this.#networkStatsWriter = networkStatsWriter;
    this.#actMigration = actMigration;
    this.#logger = logger;
    this.#logger.setContext("COMMITTER");
  }

  async commit(block: DecodedBlock): Promise<CommitResult> {
    return await this.commitBatch([block], { stream: SYNC_STREAM });
  }

  /**
   * Commits contiguous blocks and the checkpoint advance in one transaction, so the checkpoint
   * never points past uncommitted data. Inserts are conflict-ignoring and the checkpoint only
   * moves forward, so concurrent writers on the same stream (e.g. two pods overlapping during a
   * rolling deploy) duplicate work but cannot corrupt data or regress the checkpoint.
   *
   * A pending ACT denom migration splits the batch at its trigger block: the conversion commits in
   * the same transaction as that block, so later blocks' settlements run against converted state.
   */
  async commitBatch(blocks: DecodedBlock[], options: CommitOptions): Promise<CommitResult> {
    if (blocks.length === 0) {
      return { modulesSkipped: [], handoffCompleted: false };
    }

    this.#verifyContiguous(blocks);

    const replayModules = options.modules ?? null;
    const akashExpected = replayModules ? replayModules.has("akash") : !(await this.#modulesUnderReplay(this.#db)).includes("akash");
    const segments = akashExpected ? await this.#actMigration.segment(blocks) : null;
    const groups = segments ? segments.map(segment => segment.blocks) : [blocks];

    let result: CommitResult = { modulesSkipped: [], handoffCompleted: false };
    for (const [index, group] of groups.entries()) {
      const segment = segments?.[index] ?? null;
      const segmentOptions = index === groups.length - 1 ? options : { ...options, handoff: false };
      const outcome = await this.#commitSegment(group, segmentOptions, segment, replayModules);
      if (segment && outcome.akashWritten) {
        this.#actMigration.markCommitted(segment, outcome.migrationOutcome);
      }
      result = { modulesSkipped: outcome.modulesSkipped, handoffCompleted: outcome.handoffCompleted };
    }

    return result;
  }

  async #commitSegment(
    blocks: DecodedBlock[],
    options: CommitOptions,
    segment: ActMigrationSegment | null,
    replayModules: ReadonlySet<ReplayableModule> | null
  ): Promise<SegmentOutcome> {
    const includeCore = replayModules === null;
    const typeIds = includeCore ? await this.#internMessageTypes(blocks) : new Map<string, number>();

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

    const outcome = await this.#db.transaction(async tx => {
      if (includeCore || options.handoff) {
        await tx.execute(sql.raw(`SELECT pg_advisory_xact_lock(${REPLAY_HANDOFF_LOCK_KEY})`));
      }
      const modulesSkipped = includeCore ? await this.#modulesUnderReplay(tx) : [];
      const writes = (module: ReplayableModule) => (replayModules ? replayModules.has(module) : !modulesSkipped.includes(module));
      if (writes("akash") && includeCore && segment === null) {
        throw new Error(`Module replay handoff raced the commit of ${blocks[0].height}-${lastHeight}; retrying`);
      }

      let persisted: ReadonlyArray<(typeof deadLetteredMessages)[number]> = [];
      if (includeCore) {
        await this.#bulkInserter.insert(tx, Blocks, blockRows);
        await this.#bulkInserter.insert(tx, Transactions, transactionRows);
        await this.#upsertMessages(tx, messageRows);
        persisted = await this.#replaceDeadLetters(tx, blocks[0].height, lastHeight, deadLetteredMessages, typeIds);
      }

      if (writes("balance")) {
        await this.#balanceWriter.write(tx, balanceIntents);
        await this.#bulkInserter.insert(tx, AccountTxs, accountTxRows);
      }
      if (writes("gov")) {
        await this.#govWriter.writeForBlocks(tx, blocks, accountIds);
      }

      let migrationOutcome: ActMigrationOutcome | null = null;
      const akashWritten = writes("akash");
      if (akashWritten) {
        const { networkDeltas } = await this.#akashWriter.write(tx, akashChanges, accountIds);
        await this.#networkStatsWriter.write(tx, blocks, networkDeltas, { providerCountFrozen: modulesSkipped.includes("provider") });
        migrationOutcome = segment ? await this.#actMigration.applySegment(tx, segment) : null;
      }
      if (writes("provider")) {
        await this.#providerWriter.write(tx, akashChanges, accountIds);
      }
      if (writes("bme")) {
        await this.#bmeWriter.write(tx, bmeChanges, accountIds);
      }

      const handoffCompleted = options.handoff ? await this.#completeHandoffIfCaughtUp(tx, options.stream, lastHeight) : false;
      if (!handoffCompleted) {
        await advanceCheckpoint(tx, options.stream, lastHeight);
      }

      return { persistedDeadLetters: persisted, migrationOutcome, akashWritten, modulesSkipped, handoffCompleted };
    });

    if (outcome.persistedDeadLetters.length > 0) {
      this.#logger.error({
        event: "MESSAGES_DEAD_LETTERED",
        stream: options.stream,
        count: outcome.persistedDeadLetters.length,
        byType: countByTypeUrl(outcome.persistedDeadLetters),
        fromHeight: blocks[0].height,
        toHeight: lastHeight
      });
    }

    return outcome;
  }

  /** A replay that already stands at the sync checkpoint has nothing left to commit; this takes the lock and hands off if that is still true. */
  async handoffWithoutBlocks(stream: string, lastReplayedHeight: number): Promise<boolean> {
    return await this.#db.transaction(async tx => {
      await tx.execute(sql.raw(`SELECT pg_advisory_xact_lock(${REPLAY_HANDOFF_LOCK_KEY})`));
      return await this.#completeHandoffIfCaughtUp(tx, stream, lastReplayedHeight);
    });
  }

  /**
   * The replay marker comes off only when sync's checkpoint is exactly this batch's end (or sync never
   * ran), which holds for the whole transaction because sync's next commit is waiting on the handoff
   * lock: every block below the checkpoint carries the replay's rows and every block above will carry
   * sync's, with no gap and no overlap.
   */
  async #completeHandoffIfCaughtUp(tx: ChainTransaction, stream: string, lastHeight: number): Promise<boolean> {
    const [sync] = await tx.select().from(IndexerState).where(eq(IndexerState.stream, SYNC_STREAM));
    if (sync && sync.lastHeight !== lastHeight) {
      return false;
    }
    await tx.delete(IndexerState).where(eq(IndexerState.stream, stream));
    return true;
  }

  async #modulesUnderReplay(executor: ChainDatabase | ChainTransaction): Promise<ReplayableModule[]> {
    return await readModulesUnderReplay(executor);
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

    await this.#bulkInserter.insert(
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
    await this.#bulkInserter.insert(tx, Messages, rows, {
      onConflict: sql`ON CONFLICT (height, tx_index, index) DO UPDATE SET body = excluded.body WHERE ${Messages.body} IS NULL AND excluded.body IS NOT NULL`
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
