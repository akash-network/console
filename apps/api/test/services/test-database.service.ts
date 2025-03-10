import path from "path";
import postgres from "postgres";

export class TestDatabaseService {
  private readonly testFileName: string;

  private readonly dbName: string;

  private readonly indexerDbName: string;

  private readonly postgresUri: string;

  private get postgres() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("../../src/core/providers/postgres.provider");
  }

  constructor(testPath: string) {
    this.testFileName = path.basename(testPath, ".spec.ts");
    const timestamp = new Date().getTime();
    this.dbName = `${timestamp}_test_user_${this.testFileName}`.replace(/-/g, "_");
    this.indexerDbName = `${timestamp}_test_indexer_${this.testFileName}`.replace(/-/g, "_");
    this.postgresUri = process.env.POSTGRES_URI || "postgres://postgres:password@localhost:5432";

    process.env.POSTGRES_DB_URI = `${this.postgresUri}/${this.dbName}`;
    process.env.CHAIN_INDEXER_POSTGRES_DB_URI = `${this.postgresUri}/${this.indexerDbName}`;
  }

  async setup(): Promise<void> {
    console.log(`Setting up test databases for: ${this.testFileName}: ${this.dbName}, ${this.indexerDbName}`);
    await Promise.all([this.createDatabase(this.dbName), this.createDatabase(this.indexerDbName)]);

    await this.postgres.migratePG();
  }

  async teardown(): Promise<void> {
    await this.postgres.closeConnections();

    console.log(`Dropping test databases: ${this.dbName}, ${this.indexerDbName}`);
    const sql = postgres(this.postgresUri);

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
    const sql = postgres(this.postgresUri);

    try {
      const exists = await sql`
        SELECT 1 FROM pg_database WHERE datname = ${dbName}
      `;

      if (exists.length === 0) {
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
