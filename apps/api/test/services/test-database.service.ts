import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
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
    await this.migrateIndexerDb();
  }

  private async migrateIndexerDb() {
    const migrationClient = postgres(process.env.CHAIN_INDEXER_POSTGRES_DB_URI, { max: 1 });
    const pgMigrationDatabase = drizzle(migrationClient);
    const migrationsFolder = path.resolve(process.cwd(), "../indexer/drizzle");

    await migrate(pgMigrationDatabase, { migrationsFolder });
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

  public async copyIndexerTables(tableNames: string[]): Promise<void> {
    const sourceDbName = "console-akash-sandbox";
    const sql = postgres(this.postgresUri);

    try {
      const sourceDb = postgres(`${this.postgresUri}/${sourceDbName}`);
      const targetDb = postgres(`${this.postgresUri}/${this.indexerDbName}`);

      try {
        await this.copySequences(sourceDb, targetDb);
        await this.copyTables(sourceDb, targetDb, tableNames);
      } finally {
        await sourceDb.end();
        await targetDb.end();
      }
    } finally {
      await sql.end();
    }
  }

  private async copySequences(sourceDb: postgres.Sql<any>, targetDb: postgres.Sql<any>): Promise<void> {
    const sequences = await sourceDb`
      SELECT sequencename, start_value, increment_by, last_value
      FROM pg_sequences
      WHERE schemaname = 'public';
    `;

    for (const seq of sequences) {
      await targetDb.unsafe(`
        CREATE SEQUENCE IF NOT EXISTS "${seq.sequencename}"
        START WITH ${seq.last_value}
        INCREMENT BY ${seq.increment_by};
        SELECT setval('"${seq.sequencename}"', ${seq.last_value}, true);
      `);
    }
  }

  private async copyTables(sourceDb: postgres.Sql<any>, targetDb: postgres.Sql<any>, tableNames: string[]): Promise<void> {
    const schemas = await sourceDb`
          SELECT
            table_name,
            string_agg(
              quote_ident(column_name) || ' ' || data_type ||
              CASE
                WHEN character_maximum_length IS NOT NULL THEN '(' || character_maximum_length || ')'
                ELSE ''
              END ||
              CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
              CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END,
              ', '
            ) as columns
          FROM information_schema.columns
          WHERE table_schema = 'public'
          GROUP BY table_name;
        `;

    for (const schema of schemas) {
      const createTableSQL = `
            CREATE TABLE IF NOT EXISTS "${schema.table_name}" (
              ${schema.columns}
            );
          `;
      await targetDb.unsafe(createTableSQL);
    }

    for (const schema of schemas) {
      if (!tableNames.includes(schema.table_name)) {
        continue;
      }

      const tableName = schema.table_name;
      const columns = await sourceDb`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = ${tableName}
            ORDER BY ordinal_position;
          `;

      const columnNames = columns.map(c => c.column_name);
      const quotedColumnNames = columnNames.map(name => `"${name}"`);

      const data = await sourceDb`
            SELECT ${sourceDb(columnNames)}
            FROM ${sourceDb(tableName)}`;

      if (data.length > 0) {
        const chunkSize = 1000;
        for (let i = 0; i < data.length; i += chunkSize) {
          const chunk = data.slice(i, i + chunkSize);

          const valueParams = chunk
            .map((_, rowIndex) => `(${columnNames.map((_, colIndex) => `$${rowIndex * columnNames.length + colIndex + 1}`).join(", ")})`)
            .join(", ");

          const values = chunk.flatMap(row => columnNames.map(col => (row[col] === undefined ? null : row[col])));

          await targetDb.unsafe(
            `
                INSERT INTO "${tableName}" (${quotedColumnNames.join(", ")})
                VALUES ${valueParams}
              `,
            values
          );
        }
      }
    }
  }
}
