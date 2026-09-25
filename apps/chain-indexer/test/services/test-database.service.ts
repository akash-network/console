import { randomUUID } from "node:crypto";
import path from "node:path";
import postgres from "postgres";

const DEFAULT_POSTGRES_URI = "postgres://postgres:password@localhost:5432";

/** Creates a migrated, per-spec-file database so integration specs never share state, and drops it on teardown. */
export class TestDatabaseService {
  readonly #postgresUri: string;
  readonly #dbName: string;

  constructor(testPath: string) {
    const fileName = path.basename(testPath, ".integration.ts");
    this.#postgresUri = process.env.POSTGRES_URI || DEFAULT_POSTGRES_URI;
    this.#dbName = `${randomUUID().replace(/-/g, "").slice(0, 8)}_chain_indexer_${fileName}`.replace(/\W+/g, "_");
    process.env.POSTGRES_DB_URI = `${this.#postgresUri}/${this.#dbName}`;
  }

  async setup(): Promise<void> {
    const sql = postgres(this.#postgresUri, { max: 1 });
    try {
      await sql`CREATE DATABASE ${sql(this.#dbName)}`;
    } finally {
      await sql.end();
    }

    const { migrateDb } = await import("@src/providers/db.provider");
    await migrateDb();
  }

  async teardown(): Promise<void> {
    const sql = postgres(this.#postgresUri, { max: 1 });
    try {
      await sql`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${this.#dbName} AND pid <> pg_backend_pid()`;
      await sql`DROP DATABASE IF EXISTS ${sql(this.#dbName)}`;
    } finally {
      await sql.end();
    }
  }
}
