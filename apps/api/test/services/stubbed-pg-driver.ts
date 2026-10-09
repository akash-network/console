import { getTableColumns, type Table } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { vi } from "vitest";

type Row = Record<string, unknown>;

/** Answers every query from rows queued in advance, in the column order drizzle selects them, and records what was sent. */
export function stubPgDriver<TSchema extends Record<string, unknown>>({ schema, table }: { schema: TSchema; table: Table }) {
  const executedQueries: Array<{ query: string; params: unknown[] }> = [];
  const queuedResults: Row[][] = [];
  const columns = Object.keys(getTableColumns(table));
  const client = postgres("postgres://localhost:5432/unused");

  vi.spyOn(client, "unsafe").mockImplementation((query, params) => {
    executedQueries.push({ query, params: params ?? [] });
    const rows = queuedResults.shift() ?? [];
    const pending = Object.assign(Promise.resolve(rows), { values: async () => rows.map(row => columns.map(column => row[column] ?? null)) });

    return pending as unknown as ReturnType<typeof client.unsafe>;
  });

  vi.spyOn(client, "begin").mockImplementation((async (callback: (transaction: typeof client) => unknown) => {
    executedQueries.push({ query: "begin", params: [] });
    return await callback(client);
  }) as typeof client.begin);

  return {
    db: drizzle(client, { schema }),
    executedQueries,
    respondWith: (...rows: Row[]) => {
      queuedResults.push(rows);
    }
  };
}
