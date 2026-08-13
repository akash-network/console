import { and, desc, inArray, lt, sql } from "drizzle-orm";
import chunk from "lodash/chunk";
import { singleton } from "tsyringe";

import { INSERT_CHUNK_SIZE } from "@src/db/insert-chunk-size";
import { AccountBalances, BalanceChanges } from "@src/db/schema";
import type { BalanceReason } from "@src/pipeline/balance/reason-classifier";
import type { ChainTransaction } from "@src/providers/db.provider";

/** A derived balance change whose addresses have been interned to account ids, ready to persist. */
export interface ResolvedBalanceChange {
  accountId: number;
  counterpartyAccountId: number | null;
  denom: string;
  delta: bigint;
  reason: BalanceReason;
  height: number;
  txIndex: number | null;
  eventIndex: number;
}

const keyOf = (accountId: number, denom: string) => `${accountId}:${denom}`;

/**
 * Appends balance changes to the ledger and folds them into the current-balance snapshot, idempotently.
 * Runs inside the committer's transaction. The `(height, event_index)` unique index is the serialization
 * point: `onConflictDoNothing().returning()` yields only rows this call actually inserted, so re-committing
 * a block (rolling deploy, backfill overlapping the frontier) inserts zero rows and applies zero deltas.
 * The current-balance snapshot is only ever advanced by the returned rows, so it stays a pure projection of
 * the ledger and remains rebuildable from it.
 */
@singleton()
export class BalanceWriter {
  async write(tx: ChainTransaction, intents: ResolvedBalanceChange[]): Promise<void> {
    if (intents.length === 0) {
      return;
    }

    const ordered = [...intents].sort((a, b) => a.height - b.height || a.eventIndex - b.eventIndex);
    const firstHeight = ordered[0].height;

    const baseline = await this.#readLedgerBaseline(tx, ordered, firstHeight);
    const changeRows = this.#accumulateRunningBalances(ordered, baseline);

    const inserted = await this.#insertChanges(tx, changeRows);
    if (inserted.length === 0) {
      return;
    }

    await this.#applyNetDeltas(tx, inserted);
  }

  /**
   * The running balance seeds from the ledger — the `balance_after` of the last change strictly before this
   * batch — not from `account_balances`, whose snapshot a concurrent frontier writer may already have advanced.
   */
  async #readLedgerBaseline(tx: ChainTransaction, intents: ResolvedBalanceChange[], firstHeight: number): Promise<Map<string, bigint>> {
    const accountIds = [...new Set(intents.map(intent => intent.accountId))];
    const denoms = [...new Set(intents.map(intent => intent.denom))];
    const touched = new Set(intents.map(intent => keyOf(intent.accountId, intent.denom)));

    const baseline = new Map<string, bigint>();
    for (const accountIdChunk of chunk(accountIds, INSERT_CHUNK_SIZE)) {
      const rows = await tx
        .selectDistinctOn([BalanceChanges.accountId, BalanceChanges.denom], {
          accountId: BalanceChanges.accountId,
          denom: BalanceChanges.denom,
          balanceAfter: BalanceChanges.balanceAfter
        })
        .from(BalanceChanges)
        .where(and(lt(BalanceChanges.height, firstHeight), inArray(BalanceChanges.accountId, accountIdChunk), inArray(BalanceChanges.denom, denoms)))
        .orderBy(BalanceChanges.accountId, BalanceChanges.denom, desc(BalanceChanges.height), desc(BalanceChanges.eventIndex));

      for (const row of rows) {
        const key = keyOf(row.accountId, row.denom);
        if (touched.has(key)) {
          baseline.set(key, BigInt(row.balanceAfter));
        }
      }
    }
    return baseline;
  }

  #accumulateRunningBalances(intents: ResolvedBalanceChange[], baseline: Map<string, bigint>): (typeof BalanceChanges.$inferInsert)[] {
    const running = new Map<string, bigint>();

    return intents.map(intent => {
      const key = keyOf(intent.accountId, intent.denom);
      const previous = running.get(key) ?? baseline.get(key) ?? 0n;
      const balanceAfter = previous + intent.delta;
      running.set(key, balanceAfter);

      return {
        accountId: intent.accountId,
        denom: intent.denom,
        delta: intent.delta.toString(),
        balanceAfter: balanceAfter.toString(),
        reason: intent.reason,
        height: intent.height,
        txIndex: intent.txIndex,
        eventIndex: intent.eventIndex,
        counterpartyAccountId: intent.counterpartyAccountId
      };
    });
  }

  async #insertChanges(
    tx: ChainTransaction,
    changeRows: (typeof BalanceChanges.$inferInsert)[]
  ): Promise<{ accountId: number; denom: string; delta: string }[]> {
    const inserted: { accountId: number; denom: string; delta: string }[] = [];

    for (const rowChunk of chunk(changeRows, INSERT_CHUNK_SIZE)) {
      const returned = await tx
        .insert(BalanceChanges)
        .values(rowChunk)
        .onConflictDoNothing()
        .returning({ accountId: BalanceChanges.accountId, denom: BalanceChanges.denom, delta: BalanceChanges.delta });
      inserted.push(...returned);
    }

    return inserted;
  }

  /** Advances the current balance only by the rows actually inserted, summed per account+denom, so overlapping writers apply each delta exactly once. */
  async #applyNetDeltas(tx: ChainTransaction, inserted: { accountId: number; denom: string; delta: string }[]): Promise<void> {
    const netByKey = new Map<string, { accountId: number; denom: string; amount: bigint }>();
    for (const row of inserted) {
      const key = keyOf(row.accountId, row.denom);
      const existing = netByKey.get(key);
      if (existing) {
        existing.amount += BigInt(row.delta);
      } else {
        netByKey.set(key, { accountId: row.accountId, denom: row.denom, amount: BigInt(row.delta) });
      }
    }

    const balanceRows = [...netByKey.values()]
      .sort((a, b) => a.accountId - b.accountId || a.denom.localeCompare(b.denom))
      .map(entry => ({ accountId: entry.accountId, denom: entry.denom, amount: entry.amount.toString() }));

    for (const rowChunk of chunk(balanceRows, INSERT_CHUNK_SIZE)) {
      await tx
        .insert(AccountBalances)
        .values(rowChunk)
        .onConflictDoUpdate({
          target: [AccountBalances.accountId, AccountBalances.denom],
          set: { amount: sql`${AccountBalances.amount} + EXCLUDED.amount` }
        });
    }
  }
}
