import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import postgres from "postgres";
import { z } from "zod";

const config = z.object({ MIGRATION_DATABASE_URL: z.string().url() }).parse(process.env);
const client = postgres(config.MIGRATION_DATABASE_URL, { max: 1 });

async function runMigrations() {
  console.log(`Running migrations on database: ${new URL(config.MIGRATION_DATABASE_URL).pathname.slice(1)}`);
  const startedAt = Date.now();

  try {
    const possibleMigrationDirs = [path.join(process.cwd(), "drizzle"), path.join(process.cwd(), "dist", "drizzle")];
    const migrationDir = possibleMigrationDirs.find(dir => fs.existsSync(dir));

    if (!migrationDir) throw new Error(`No migration directory found. Checked: ${possibleMigrationDirs.join(", ")}`);

    await migrate(drizzle(client), { migrationsFolder: migrationDir });
    console.log(`Migrations completed in ${Date.now() - startedAt}ms`);
  } finally {
    await client.end();
  }
}

runMigrations().catch(error => {
  console.error("Migration failed:", error);
  process.exit(1);
});
