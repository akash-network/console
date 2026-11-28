import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { randomUUID } from "node:crypto";
import path from "node:path";
import postgres from "postgres";
import { afterAll, beforeAll, expect } from "vitest";

const POSTGRES_SERVER_URL = process.env.TEST_POSTGRES_URI || "postgres://postgres:password@localhost:5432";
const MAX_POSTGRES_NAME_LENGTH = 63;

export class TestDatabaseService {
  readonly #name: string;

  constructor(testPath: string) {
    const fileName = path.basename(testPath).replace(/\.(spec|integration)\.ts$/, "");

    this.#name = `signer_test_${randomUUID().replace(/-/g, "")}_${fileName}`.replace(/\W+/g, "_").slice(0, MAX_POSTGRES_NAME_LENGTH);
  }

  get url(): string {
    return `${POSTGRES_SERVER_URL}/${this.#name}`;
  }

  async setup(): Promise<void> {
    const server = postgres(POSTGRES_SERVER_URL, { max: 1 });

    try {
      await server`CREATE DATABASE ${server(this.#name)}`;
    } finally {
      await server.end();
    }

    const database = postgres(this.url, { max: 1 });

    try {
      await migrate(drizzle(database), { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
    } finally {
      await database.end();
    }
  }

  async teardown(): Promise<void> {
    const server = postgres(POSTGRES_SERVER_URL, { max: 1 });

    try {
      await server`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = ${this.#name} AND pid <> pg_backend_pid()`;
      await server`DROP DATABASE IF EXISTS ${server(this.#name)}`;
    } finally {
      await server.end();
    }
  }
}

export function createTestDatabase(): TestDatabaseService {
  const testPath = expect.getState().testPath;

  if (!testPath) throw new Error("Unable to detect the test path a database is created for");

  const testDatabase = new TestDatabaseService(testPath);

  beforeAll(() => testDatabase.setup());
  afterAll(() => testDatabase.teardown());

  return testDatabase;
}
