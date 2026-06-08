import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { randomUUID } from "node:crypto";
import path from "node:path";
import postgres from "postgres";

export class TestDatabaseService {
  readonly #postgresUri: string;
  readonly #dbName: string;

  constructor(testPath: string) {
    if (!process.env.PROVIDER_INVENTORY_POSTGRES_URL) {
      throw new Error("PROVIDER_INVENTORY_POSTGRES_URL is not set");
    }
    const fileName = path.basename(testPath).replace(/\.(spec|integration)\.ts$/, "");
    const prefix = randomUUID().replace(/-/g, "");
    this.#postgresUri = process.env.PROVIDER_INVENTORY_POSTGRES_URL;
    this.#dbName = `pi_test_${prefix}_${fileName}`.replace(/\W+/g, "_");
    process.env.PROVIDER_INVENTORY_POSTGRES_URL = `${this.#postgresUri}/${this.#dbName}`;
  }

  async setup(): Promise<void> {
    await this.#createDatabase();
    await this.#runMigrations();
  }

  async teardown(): Promise<void> {
    const sql = postgres(this.#postgresUri, { max: 1 });
    try {
      await sql`
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = ${this.#dbName} AND pid <> pg_backend_pid()
      `;
      await sql`DROP DATABASE IF EXISTS ${sql(this.#dbName)}`;
    } finally {
      await sql.end();
    }
  }

  async truncate(): Promise<void> {
    const sql = postgres(`${this.#postgresUri}/${this.#dbName}`, { max: 1 });
    try {
      await sql`TRUNCATE TABLE provider_inventory, provider_incidents RESTART IDENTITY CASCADE`;
    } finally {
      await sql.end();
    }
  }

  async #createDatabase(): Promise<void> {
    const sql = postgres(this.#postgresUri, { max: 1 });
    try {
      const [exists] = await sql`SELECT 1 FROM pg_database WHERE datname = ${this.#dbName}`;
      if (!exists) {
        await sql`CREATE DATABASE ${sql(this.#dbName)}`;
      }
    } finally {
      await sql.end();
    }
  }

  async #runMigrations(): Promise<void> {
    const migrationClient = postgres(`${this.#postgresUri}/${this.#dbName}`, { max: 1 });
    try {
      await migrate(drizzle(migrationClient), { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
    } finally {
      await migrationClient.end();
    }
  }
}
