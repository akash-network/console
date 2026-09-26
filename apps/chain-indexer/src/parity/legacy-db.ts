import postgres from "postgres";
import type { InjectionToken } from "tsyringe";

/** A raw postgres.js client on the legacy indexer's database; its schema is not modelled here, so parity checks query it with SQL strings. */
export type LegacyDatabase = postgres.Sql;

export const LEGACY_DB: InjectionToken<LegacyDatabase> = Symbol("LEGACY_DB");

export function createLegacyDatabase(uri: string): LegacyDatabase {
  return postgres(uri, { max: 2, connection: { default_transaction_read_only: true } });
}
