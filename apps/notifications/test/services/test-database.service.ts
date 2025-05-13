import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "path";
import { join } from "path";
import { Client } from "pg";

export class TestDatabaseService {
  private readonly testFileName: string;

  private readonly eventBrokerDbName: string;
  private readonly notificationsDbName: string;

  private readonly postgresUri: string;

  constructor(testPath: string) {
    this.testFileName = path.basename(testPath, ".spec.ts");
    const timestamp = Date.now();

    this.eventBrokerDbName = `test_event_broker_${timestamp}_${this.testFileName}`.replace(/-/g, "_");
    this.notificationsDbName = `test_notifications_${timestamp}_${this.testFileName}`.replace(/-/g, "_");

    if (!process.env.POSTGRES_BASE_URL) {
      throw new Error("POSTGRES_BASE_URL environment variable is not set");
    }

    this.postgresUri = process.env.POSTGRES_BASE_URL;

    process.env.EVENT_BROKER_POSTGRES_URI = `${this.postgresUri}/${this.eventBrokerDbName}`;
    process.env.NOTIFICATIONS_POSTGRES_URL = `${this.postgresUri}/${this.notificationsDbName}`;
  }

  async setup(): Promise<void> {
    console.log(`🧪 Setting up test DBs for ${this.testFileName}: ${this.eventBrokerDbName}, ${this.notificationsDbName}`);

    await Promise.all([this.createDatabase(this.eventBrokerDbName), this.createDatabase(this.notificationsDbName)]);

    await this.runMigrations(`${this.postgresUri}/${this.notificationsDbName}`);
  }

  async teardown(): Promise<void> {
    console.log(`🧹 Dropping test DBs: ${this.eventBrokerDbName}, ${this.notificationsDbName}`);
    const client = new Client({ connectionString: this.postgresUri });
    await client.connect();

    try {
      for (const dbName of [this.eventBrokerDbName, this.notificationsDbName]) {
        await client.query(`DROP DATABASE IF EXISTS "${dbName}"`);
      }
    } catch (error) {
      console.error("❌ Error during teardown:", error);
    } finally {
      await client.end();
    }
  }

  private async createDatabase(dbName: string): Promise<void> {
    const client = new Client({ connectionString: this.postgresUri });
    await client.connect();

    try {
      const result = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);

      if (result.rowCount === 0) {
        await client.query(`CREATE DATABASE "${dbName}"`);
      } else {
        console.log(`⚠️ Database ${dbName} already exists`);
      }
    } catch (error) {
      console.error(`❌ Error creating database ${dbName}:`, error);
      throw error;
    } finally {
      await client.end();
    }
  }

  private async runMigrations(databaseUrl: string): Promise<void> {
    const client = new Client({ connectionString: databaseUrl });
    await client.connect();

    const db = drizzle(client);
    const migrationsFolder = join(process.cwd(), "drizzle");

    try {
      await migrate(db, { migrationsFolder });
    } catch (err) {
      console.error(`❌ Migration failed for ${databaseUrl}:`, err);
      throw err;
    } finally {
      await client.end();
    }
  }
}
