import type { SQL } from "drizzle-orm";
import { getTableColumns, sql } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { getTableConfig, PgEnumColumn } from "drizzle-orm/pg-core";
import { singleton } from "tsyringe";

import type { ChainTransaction } from "@src/providers/db.provider";

export interface BulkInsertOptions {
  /** The full `ON CONFLICT ...` clause, or `"error"` for none; conflicts are ignored by default so re-committing a block is idempotent. */
  onConflict?: SQL | "error";
  /** A raw `RETURNING` column list in SQL column names, e.g. sql`account_id AS "accountId", delta`. */
  returning?: SQL;
}

/**
 * Bulk inserts as one statement over `unnest`ed column arrays: one bind parameter per column instead
 * of one per value, so query construction stays O(columns) and no batch size approaches the driver's
 * bind-parameter limit. Every element travels as text and is cast to its column type inside the select,
 * because the driver serializes elements of `jsonb[]` and enum arrays incorrectly. Every row must carry
 * the same keys; columns absent from the rows take their database defaults.
 */
@singleton()
export class BulkInserter {
  async insert<TTable extends PgTable, TRow extends Record<string, unknown> = Record<string, unknown>>(
    tx: ChainTransaction,
    table: TTable,
    rows: TTable["$inferInsert"][],
    options: BulkInsertOptions = {}
  ): Promise<TRow[]> {
    if (rows.length === 0) {
      return [];
    }

    const columns = getTableColumns(table) as Record<string, PgColumn>;
    const keys = Object.keys(rows[0]).filter(key => key in columns);
    const columnList = sql.join(
      keys.map(key => sql.identifier(columns[key].name)),
      sql`, `
    );
    const castList = sql.join(
      keys.map(key => sql`${sql.identifier(columns[key].name)}::${sql.raw(sqlTypeOf(columns[key]))}`),
      sql`, `
    );
    const textArrays = sql.join(
      keys.map(key => sql`${sql.param(rows.map(row => toText((row as Record<string, unknown>)[key])))}::text[]`),
      sql`, `
    );

    const query = sql`INSERT INTO ${tableReference(table)} (${columnList}) SELECT ${castList} FROM unnest(${textArrays}) AS r(${columnList})`;
    if (options.onConflict !== "error") {
      query.append(sql` ${options.onConflict ?? sql`ON CONFLICT DO NOTHING`}`);
    }
    if (options.returning) {
      query.append(sql` RETURNING ${options.returning}`);
    }

    return [...(await tx.execute(query))] as TRow[];
  }
}

function tableReference(table: PgTable): SQL {
  const { schema, name } = getTableConfig(table);
  return schema ? sql`${sql.identifier(schema)}.${sql.identifier(name)}` : sql`${sql.identifier(name)}`;
}

/** Enum columns report the bare enum name, which resolves only through the search path, so the enum's schema is qualified explicitly. */
function sqlTypeOf(column: PgColumn): string {
  if (column instanceof PgEnumColumn) {
    const { enumName, schema } = column.enum as { enumName: string; schema?: string };
    return `${schema ? `"${schema}".` : ""}"${enumName}"`;
  }
  return column.getSQLType();
}

/** Renders a value in the text input form of its Postgres type: bytea as hex, timestamps as ISO 8601, jsonb as JSON, everything else via String. */
function toText(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (Buffer.isBuffer(value)) {
    return `\\x${value.toString("hex")}`;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}
