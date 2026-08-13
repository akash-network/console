import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { AccountBalances, BalanceChanges } from "@src/db/schema";
import type { ResolvedBalanceChange } from "@src/pipeline/balance/balance-writer.service";
import { BalanceWriter } from "@src/pipeline/balance/balance-writer.service";
import type { ChainTransaction } from "@src/providers/db.provider";

describe(BalanceWriter.name, () => {
  it("computes each ledger entry's running balance from the ledger baseline", async () => {
    const { writer, tx, balanceChangeRows } = setup({ baseline: [{ accountId: 1, denom: "uakt", balanceAfter: "100" }] });

    await writer.write(tx, [change({ accountId: 1, delta: 50n, eventIndex: 0 }), change({ accountId: 1, delta: -30n, eventIndex: 1 })]);

    expect(balanceChangeRows().map(row => row.balanceAfter)).toEqual(["150", "120"]);
  });

  it("seeds the running balance from zero for an account with no prior ledger history", async () => {
    const { writer, tx, balanceChangeRows } = setup();

    await writer.write(tx, [change({ accountId: 2, delta: 10n, eventIndex: 0 })]);

    expect(balanceChangeRows().map(row => row.balanceAfter)).toEqual(["10"]);
  });

  it("carries the running balance across non-adjacent heights within a batch", async () => {
    const { writer, tx, balanceChangeRows } = setup();

    await writer.write(tx, [change({ accountId: 1, delta: 5n, height: 10, eventIndex: 0 }), change({ accountId: 1, delta: -2n, height: 13, eventIndex: 0 })]);

    expect(balanceChangeRows().map(row => row.balanceAfter)).toEqual(["5", "3"]);
  });

  it("sorts intents by height then event index before accumulating", async () => {
    const { writer, tx, balanceChangeRows } = setup();

    await writer.write(tx, [change({ accountId: 1, delta: -2n, height: 13, eventIndex: 0 }), change({ accountId: 1, delta: 5n, height: 10, eventIndex: 0 })]);

    expect(balanceChangeRows().map(row => ({ height: row.height, balanceAfter: row.balanceAfter }))).toEqual([
      { height: 10, balanceAfter: "5" },
      { height: 13, balanceAfter: "3" }
    ]);
  });

  it("advances the current-balance snapshot additively with the summed net delta of the inserted rows", async () => {
    const { writer, tx, balanceUpserts, conflictSet } = setup();

    await writer.write(tx, [change({ accountId: 1, delta: 50n, eventIndex: 0 }), change({ accountId: 1, delta: -30n, eventIndex: 1 })]);

    expect(balanceUpserts()).toEqual([{ accountId: 1, denom: "uakt", amount: "20" }]);
    expect(new PgDialect().sqlToQuery(conflictSet()!.amount).sql).toBe('"cosmos"."account_balances"."amount" + EXCLUDED.amount');
  });

  it("applies zero deltas when a re-commit inserts no new rows", async () => {
    const { writer, tx, balanceUpserts } = setup({ insertReturning: [] });

    await writer.write(tx, [change({ accountId: 1, delta: 50n, eventIndex: 0 })]);

    expect(balanceUpserts()).toEqual([]);
  });

  it("keeps running balances correct while advancing the snapshot only by newly-inserted rows when a batch straddles the sync frontier", async () => {
    const { writer, tx, balanceChangeRows, balanceUpserts } = setup({
      baseline: [{ accountId: 1, denom: "uakt", balanceAfter: "100" }],
      insertReturning: [{ accountId: 1, denom: "uakt", delta: "7" }]
    });

    await writer.write(tx, [change({ accountId: 1, delta: 5n, height: 10, eventIndex: 0 }), change({ accountId: 1, delta: 7n, height: 11, eventIndex: 0 })]);

    expect(balanceChangeRows().map(row => row.balanceAfter)).toEqual(["105", "112"]);
    expect(balanceUpserts()).toEqual([{ accountId: 1, denom: "uakt", amount: "7" }]);
  });

  it("does nothing for an empty intent set", async () => {
    const { writer, tx, calls } = setup();

    await writer.write(tx, []);

    expect(calls()).toBe(0);
  });

  it("reads the baseline in chunks so a batch touching more accounts than the chunk size stays under the bind-parameter limit", async () => {
    const chunkSize = 2000;
    const accountIds = Array.from({ length: chunkSize + 1 }, (_, index) => index + 1);
    const { writer, tx, balanceChangeRows, baselineSelects } = setup({
      baselineByChunk: [[{ accountId: 1, denom: "uakt", balanceAfter: "100" }], [{ accountId: chunkSize + 1, denom: "uakt", balanceAfter: "500" }]]
    });

    await writer.write(
      tx,
      accountIds.map((accountId, index) => change({ accountId, delta: 10n, eventIndex: index }))
    );

    expect(baselineSelects()).toBe(2);
    const balanceAfterByAccount = new Map(balanceChangeRows().map(row => [row.accountId, row.balanceAfter]));
    expect(balanceAfterByAccount.get(1)).toBe("110");
    expect(balanceAfterByAccount.get(chunkSize + 1)).toBe("510");
  });

  function change(input: Partial<ResolvedBalanceChange>): ResolvedBalanceChange {
    return {
      accountId: 1,
      counterpartyAccountId: null,
      denom: "uakt",
      delta: 0n,
      reason: "transfer",
      height: 10,
      txIndex: 0,
      eventIndex: 0,
      ...input
    };
  }

  function setup(input?: {
    baseline?: Array<{ accountId: number; denom: string; balanceAfter: string }>;
    baselineByChunk?: Array<Array<{ accountId: number; denom: string; balanceAfter: string }>>;
    insertReturning?: Array<{ accountId: number; denom: string; delta: string }>;
  }) {
    const balanceChangeInserts: Record<string, unknown>[] = [];
    const balanceBalanceUpserts: Record<string, unknown>[] = [];
    const baselineByChunk = [...(input?.baselineByChunk ?? [])];
    let conflictSet: { amount: SQL } | undefined;
    let calls = 0;
    let baselineSelects = 0;

    const txFake = {
      selectDistinctOn: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => {
              calls++;
              baselineSelects++;
              return Promise.resolve(baselineByChunk.length > 0 ? baselineByChunk.shift()! : input?.baseline ?? []);
            }
          })
        })
      }),
      insert: (table: unknown) => ({
        values: (rows: Record<string, unknown>[]) => {
          calls++;
          if (table === BalanceChanges) {
            balanceChangeInserts.push(...rows);
          } else if (table === AccountBalances) {
            balanceBalanceUpserts.push(...rows);
          }
          return {
            onConflictDoNothing: () => ({
              returning: () => Promise.resolve(input?.insertReturning ?? rows.map(row => ({ accountId: row.accountId, denom: row.denom, delta: row.delta })))
            }),
            onConflictDoUpdate: (config: { set: { amount: SQL } }) => {
              conflictSet = config.set;
              return Promise.resolve();
            }
          };
        }
      })
    };

    const writer = new BalanceWriter();
    return {
      writer,
      tx: txFake as unknown as ChainTransaction,
      balanceChangeRows: () => balanceChangeInserts,
      balanceUpserts: () => balanceBalanceUpserts,
      conflictSet: () => conflictSet,
      calls: () => calls,
      baselineSelects: () => baselineSelects
    };
  }
});
