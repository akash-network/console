import type { PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { INSERT_CHUNK_SIZE } from "@src/db/insert-chunk-size";
import { insertChunked } from "@src/db/insert-chunked";
import { AccountBalances } from "@src/db/schema";
import type { ChainTransaction } from "@src/providers/db.provider";

describe(insertChunked.name, () => {
  it("splits rows into chunks that stay within the insert limit and preserves their order", async () => {
    const { tx, inserts } = setup();
    const rows = buildBalanceRows(INSERT_CHUNK_SIZE + 500);

    await insertChunked(tx, AccountBalances, rows);

    expect(inserts.map(insert => insert.rows.length)).toEqual([INSERT_CHUNK_SIZE, 500]);
    expect(inserts.flatMap(insert => insert.rows)).toEqual(rows);
  });

  it("ignores conflicts on every chunk by default", async () => {
    const { tx, inserts } = setup();

    await insertChunked(tx, AccountBalances, buildBalanceRows(3));

    expect(inserts.every(insert => insert.onConflict)).toBe(true);
  });

  it("writes every chunk without a conflict target when conflict handling is disabled", async () => {
    const { tx, inserts } = setup();

    await insertChunked(tx, AccountBalances, buildBalanceRows(3), { onConflictDoNothing: false });

    expect(inserts.every(insert => insert.onConflict)).toBe(false);
  });

  it("issues no insert for an empty row set", async () => {
    const { tx, inserts } = setup();

    await insertChunked(tx, AccountBalances, []);

    expect(inserts).toEqual([]);
  });

  function buildBalanceRows(count: number): (typeof AccountBalances.$inferInsert)[] {
    return Array.from({ length: count }, (_, index) => ({ accountId: index, denom: "uakt", amount: String(index) }));
  }

  function setup() {
    const inserts: { rows: Record<string, unknown>[]; onConflict: boolean }[] = [];
    const tx = {
      insert(_table: PgTable) {
        return {
          values(rows: Record<string, unknown>[]) {
            const record = { rows, onConflict: false };
            inserts.push(record);
            return Object.assign(Promise.resolve(), {
              onConflictDoNothing: () => {
                record.onConflict = true;
                return Promise.resolve();
              }
            });
          }
        };
      }
    };
    return { tx: tx as unknown as ChainTransaction, inserts };
  }
});
