import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import path from "path";
import postgres from "postgres";

export class TestDatabaseService {
  private readonly testFileName: string;

  private readonly dbName: string;

  private readonly indexerDbName: string;

  private readonly postgresUri: string;

  constructor(testPath: string) {
    this.testFileName = path.basename(testPath, ".spec.ts");
    const timestamp = Date.now();
    this.dbName = `${timestamp}_test_user_${this.testFileName}`.replace(/\W+/g, "_");
    this.indexerDbName = `${timestamp}_test_indexer_${this.testFileName}`.replace(/\W+/g, "_");
    this.postgresUri = process.env.POSTGRES_URI || "postgres://postgres:password@localhost:5432";

    process.env.POSTGRES_DB_URI = `${this.postgresUri}/${this.dbName}`;
    process.env.CHAIN_INDEXER_POSTGRES_DB_URI = `${this.postgresUri}/${this.indexerDbName}`;
  }

  async setup(): Promise<void> {
    console.log(`Setting up test databases for: ${this.testFileName}: ${this.dbName}, ${this.indexerDbName}`);
    await Promise.all([this.createDatabase(this.dbName), this.createDatabase(this.indexerDbName)]);

    // Need to load it dynamically to ensure it doesn't trigger side effects too early
    const { migratePG } = await import("../../src/core/providers/postgres.provider.ts");

    await Promise.all([migratePG(), this.migrateIndexerDb()]);
  }

  private async migrateIndexerDb() {
    if (!process.env.CHAIN_INDEXER_POSTGRES_DB_URI) {
      throw new Error("process.env.CHAIN_INDEXER_POSTGRES_DB_URI is not set");
    }

    const migrationClient = postgres(process.env.CHAIN_INDEXER_POSTGRES_DB_URI, { max: 1 });
    const pgMigrationDatabase = drizzle(migrationClient);
    const migrationsFolder = path.resolve(process.cwd(), "../indexer/drizzle");

    try {
      await migrate(pgMigrationDatabase, { migrationsFolder });
    } finally {
      await migrationClient.end();
    }
  }

  async teardown(): Promise<void> {
    console.log(`Dropping test databases: ${this.dbName}, ${this.indexerDbName}`);
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

  private async createDatabase(dbName: string): Promise<void> {
    const sql = postgres(this.postgresUri, { max: 1 });

    try {
      const [exists] = await sql`
        SELECT 1 FROM pg_database WHERE datname = ${dbName}
      `;

      if (!exists) {
        await sql`CREATE DATABASE ${sql(dbName)}`;
      } else {
        console.log(`Database ${dbName} already exists`);
      }
    } catch (error) {
      console.error(`Error creating database ${dbName}:`, error);
      throw error;
    } finally {
      await sql.end();
    }
  }
}
