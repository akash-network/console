/* eslint-disable import-x/no-extraneous-dependencies, import-x/no-unresolved */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import postgres from "postgres";
import { z } from "zod";

const envSchema = z.object({
  MIGRATION_DATABASE_URL: z.string().url()
});

const config = envSchema.parse(process.env);

const client = postgres(config.MIGRATION_DATABASE_URL, { max: 1 });
const db = drizzle(client);

async function runMigrations() {
  const dbUrl = new URL(config.MIGRATION_DATABASE_URL);
  console.log(`Running migrations on database: ${dbUrl.pathname.slice(1)}`);
  const start = Date.now();
  try {
    const possibleMigrationDirs = [path.join(process.cwd(), "drizzle"), path.join(process.cwd(), "dist", "drizzle")];
    const migrationDir = possibleMigrationDirs.find(dir => fs.existsSync(dir));
    if (!migrationDir) {
      throw new Error(`No migration directory found. Checked: ${possibleMigrationDirs.join(", ")}`);
    }
    await migrate(db, { migrationsFolder: migrationDir });
    console.log(`Migrations completed in ${Date.now() - start}ms`);
  } finally {
    await client.end();
  }
}

runMigrations().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
