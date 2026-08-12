import { describe, expect, it } from "vitest";

import { Accounts } from "@src/db/schema";
import { AccountInterner } from "@src/pipeline/balance/account-interner.service";
import type { ChainDatabase } from "@src/providers/db.provider";

describe(AccountInterner.name, () => {
  it("returns existing ids without inserting when every address is already interned", async () => {
    const { interner, insertedRows } = setup({
      selectResults: [
        [
          { id: 1, address: "akash1a" },
          { id: 2, address: "akash1b" }
        ]
      ]
    });

    const ids = await interner.resolve(["akash1a", "akash1b"]);

    expect(ids).toEqual(
      new Map([
        ["akash1a", 1],
        ["akash1b", 2]
      ])
    );
    expect(insertedRows).toEqual([]);
  });

  it("inserts only the missing addresses and merges the returned ids", async () => {
    const { interner, insertedRows } = setup({ selectResults: [[{ id: 1, address: "akash1a" }]], insertReturning: [{ id: 2, address: "akash1b" }] });

    const ids = await interner.resolve(["akash1a", "akash1b"]);

    expect(insertedRows).toEqual([{ table: Accounts, rows: [{ address: "akash1b" }] }]);
    expect(ids).toEqual(
      new Map([
        ["akash1a", 1],
        ["akash1b", 2]
      ])
    );
  });

  it("re-selects addresses lost to a concurrent insert", async () => {
    const { interner } = setup({ selectResults: [[], [{ id: 5, address: "akash1c" }]], insertReturning: [] });

    const ids = await interner.resolve(["akash1c"]);

    expect(ids).toEqual(new Map([["akash1c", 5]]));
  });

  it("dedups repeated addresses so each is interned once", async () => {
    const { interner, insertedRows } = setup({ selectResults: [[]], insertReturning: [{ id: 1, address: "akash1a" }] });

    await interner.resolve(["akash1a", "akash1a"]);

    expect(insertedRows).toEqual([{ table: Accounts, rows: [{ address: "akash1a" }] }]);
  });

  it("does nothing for an empty address set", async () => {
    const { interner, insertedRows, selectCount } = setup();

    const ids = await interner.resolve([]);

    expect(ids.size).toBe(0);
    expect(insertedRows).toEqual([]);
    expect(selectCount()).toBe(0);
  });

  function setup(input?: { selectResults?: Array<Array<{ id: number; address: string }>>; insertReturning?: Array<{ id: number; address: string }> }) {
    const selectResults = [...(input?.selectResults ?? [[]])];
    const insertedRows: Array<{ table: unknown; rows: unknown }> = [];
    let selects = 0;

    const dbFake = {
      select: () => ({
        from: () => ({
          where: () => {
            selects++;
            return Promise.resolve(selectResults.shift() ?? []);
          }
        })
      }),
      insert: (table: unknown) => ({
        values: (rows: unknown) => {
          insertedRows.push({ table, rows });
          return { onConflictDoNothing: () => ({ returning: () => Promise.resolve(input?.insertReturning ?? []) }) };
        }
      })
    };

    const interner = new AccountInterner(dbFake as unknown as ChainDatabase);
    return { interner, insertedRows, selectCount: () => selects };
  }
});
