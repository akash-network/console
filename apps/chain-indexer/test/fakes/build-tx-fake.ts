import type { ChainTransaction } from "@src/providers/db.provider";

export interface RecordedInsert {
  table: unknown;
  rows: Record<string, unknown>[];
}

/**
 * Minimal drizzle-transaction double that records inserts and supports the seeders'
 * `.values(...).onConflictDoNothing().returning()` chain. `.returning()` echoes each inserted row with an
 * incrementing `id`, matching how genesis seeds an empty accounts table and reads the ids straight back.
 */
export function buildTxFake(): { tx: ChainTransaction; inserts: RecordedInsert[] } {
  const inserts: RecordedInsert[] = [];
  let nextId = 1;

  const tx = {
    insert(table: unknown) {
      return {
        values(rows: Record<string, unknown> | Record<string, unknown>[]) {
          const rowArray = Array.isArray(rows) ? rows : [rows];
          inserts.push({ table, rows: rowArray });
          const returning = () => Promise.resolve(rowArray.map(row => ({ id: nextId++, ...row })));
          return Object.assign(Promise.resolve(), {
            returning,
            onConflictDoNothing: () => Object.assign(Promise.resolve(), { returning }),
            onConflictDoUpdate: () => Promise.resolve()
          });
        }
      };
    }
  };

  return { tx: tx as unknown as ChainTransaction, inserts };
}

export function rowsFor(inserts: RecordedInsert[], table: unknown): Record<string, unknown>[] {
  return inserts.filter(insert => insert.table === table).flatMap(insert => insert.rows);
}
