import { randomUUID } from "node:crypto";
import path from "node:path";
import postgres from "postgres";

import { INDEXER_TEMPLATE_ENV_VAR, USER_TEMPLATE_ENV_VAR } from "./test-database-templates";

export class TestDatabaseService {
  private readonly testFileName: string;

  private readonly dbName: string;

  private readonly indexerDbName: string;

  private readonly postgresUri: string;

  constructor(testPath: string) {
    this.testFileName = path.basename(testPath).replace(/\.(integration|spec)\.ts$/, "");
    const dbPrefix = randomUUID().slice(0, 8);
    this.dbName = `${dbPrefix}_test_user_${this.testFileName}`.replace(/\W+/g, "_");
    this.indexerDbName = `${dbPrefix}_test_indexer_${this.testFileName}`.replace(/\W+/g, "_");
    this.postgresUri = process.env.POSTGRES_URI || "postgres://postgres:password@localhost:5432";

    process.env.POSTGRES_DB_URI = `${this.postgresUri}/${this.dbName}`;
    process.env.CHAIN_INDEXER_POSTGRES_DB_URI = `${this.postgresUri}/${this.indexerDbName}`;
  }

  async setup(): Promise<void> {
    await Promise.all([
      this.createDatabase(this.dbName, requireTemplate(USER_TEMPLATE_ENV_VAR)),
      this.createDatabase(this.indexerDbName, requireTemplate(INDEXER_TEMPLATE_ENV_VAR))
    ]);
  }

  async teardown(): Promise<void> {
    const sql = postgres(this.postgresUri, { max: 1 });

    try {
      await Promise.all(
        [this.dbName, this.indexerDbName].map(async dbName => {
          await sql`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = ${dbName}
          AND pid <> pg_backend_pid()
        `.then(() => sql`DROP DATABASE IF EXISTS ${sql(dbName)}`);
        })
      );
    } catch (error) {
      console.error(`Error dropping databases:`, error);
    } finally {
      await sql.end();
    }
  }

  private async createDatabase(dbName: string, template: string): Promise<void> {
    const sql = postgres(this.postgresUri, { max: 1 });

    try {
      await sql`CREATE DATABASE ${sql(dbName)} TEMPLATE ${sql(template)}`;
    } catch (error) {
      console.error(`Error creating database ${dbName}:`, error);
      throw error;
    } finally {
      await sql.end();
    }
  }
}

function requireTemplate(envVar: string): string {
  const template = process.env[envVar];

  if (!template) {
    throw new Error(`${envVar} is not set. The test database templates are built by test/global-setup-db.ts.`);
  }

  return template;
}
