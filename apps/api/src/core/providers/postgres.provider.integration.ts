import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import postgres from "postgres";
import { container } from "tsyringe";
import { describe, expect, it, onTestFinished } from "vitest";

import { CORE_CONFIG } from "./config.provider";
import { migratePG } from "./postgres.provider";

describe(migratePG.name, () => {
  it("applies a pending migration once when several servers boot at the same time", async () => {
    const { config, countProbeMigrationRuns } = setup();

    await Promise.all([migratePG(config), migratePG(config), migratePG(config)]);

    expect(await countProbeMigrationRuns()).toBe(1);
  });

  it("migrates through the dedicated migration connection when one is configured", async () => {
    const { config, countProbeMigrationRuns } = setup({ appDbUri: "postgres://postgres@127.0.0.1:1/unreachable" });

    await migratePG(config);

    expect(await countProbeMigrationRuns()).toBe(1);
  });

  function setup(input: { appDbUri?: string } = {}) {
    const migrationsFolder = mkdtempSync(path.join(tmpdir(), "migration-race-"));
    const createdAt = Date.now();
    const tag = "0000_migration_race_probe";

    writeFileSync(
      path.join(migrationsFolder, `${tag}.sql`),
      `SELECT pg_sleep(0.3);\n--> statement-breakpoint\nCREATE TABLE "migration_race_probe_${createdAt}" ("id" integer);\n`
    );
    mkdirSync(path.join(migrationsFolder, "meta"));
    writeFileSync(
      path.join(migrationsFolder, "meta", "_journal.json"),
      JSON.stringify({ version: "7", dialect: "postgresql", entries: [{ idx: 0, version: "7", when: createdAt, tag, breakpoints: true }] })
    );

    const coreConfig = container.resolve(CORE_CONFIG);
    const config = {
      ...coreConfig,
      DRIZZLE_MIGRATIONS_FOLDER: migrationsFolder,
      ...(input.appDbUri && { POSTGRES_DB_URI: input.appDbUri, POSTGRES_MIGRATION_DB_URI: coreConfig.POSTGRES_DB_URI })
    };
    const sql = postgres(coreConfig.POSTGRES_DB_URI, { max: 1 });

    onTestFinished(async () => {
      await sql.end();
      rmSync(migrationsFolder, { recursive: true, force: true });
    });

    const countProbeMigrationRuns = async () => {
      const [{ count }] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations WHERE created_at = ${createdAt}`;
      return count;
    };

    return { config, countProbeMigrationRuns };
  }
});
