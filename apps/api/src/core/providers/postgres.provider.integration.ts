import { once } from "lodash";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import postgres from "postgres";
import { container } from "tsyringe";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { CORE_CONFIG } from "./config.provider";
import { migratePG, MIGRATION_ADVISORY_LOCK_KEY, POSTGRES_DB } from "./postgres.provider";

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

  it("retries a migration that timed out on a table lock once the lock is released", async () => {
    const { config, holdLockOnProbeTable, countProbeMigrationRuns, listProbeTableColumns } = setup({ migration: "alterLockedTable" });
    const releaseLock = await holdLockOnProbeTable();
    setTimeout(releaseLock, 300);

    await migratePG(config, { lockRetryDelaysMs: [1_000] });

    expect(await countProbeMigrationRuns()).toBe(1);
    expect(await listProbeTableColumns()).toEqual(["id", "added_by_migration"]);
  });

  it("waits for the migration lock again when its session drops between retries", async () => {
    const {
      config,
      holdLockOnProbeTable,
      terminateMigrationSessionAfterFailedAttempt,
      holdMigrationLock,
      waitForMigrationLockRequest,
      countProbeMigrationRuns
    } = setup({ migration: "alterLockedTable" });
    const releaseTableLock = await holdLockOnProbeTable();
    const migration = migratePG(config, { lockRetryDelaysMs: [1_000] });
    await terminateMigrationSessionAfterFailedAttempt();
    const releaseMigrationLock = await holdMigrationLock();
    await releaseTableLock();

    await waitForMigrationLockRequest();
    const runsWhileLockHeldElsewhere = await countProbeMigrationRuns();
    await releaseMigrationLock();
    await migration;

    expect(runsWhileLockHeldElsewhere).toBe(0);
    expect(await countProbeMigrationRuns()).toBe(1);
  });

  it("fails with the lock timeout once the lock outlasts every retry", async () => {
    const { config, holdLockOnProbeTable } = setup({ migration: "alterLockedTable" });
    await holdLockOnProbeTable();

    await expect(migratePG(config, { lockRetryDelaysMs: [10] })).rejects.toMatchObject({ cause: { code: "55P03" } });
  });

  it("fails without retrying when a migration fails for another reason", { timeout: 10_000 }, async () => {
    const { config } = setup({ migration: "divideByZero" });

    await expect(migratePG(config, { lockRetryDelaysMs: [30_000] })).rejects.toMatchObject({ cause: { code: "22012" } });
  });

  function setup(input: { appDbUri?: string; migration?: "createTable" | "alterLockedTable" | "divideByZero" } = {}) {
    const migrationsFolder = mkdtempSync(path.join(tmpdir(), "migration-race-"));
    const createdAt = Date.now();
    const tag = "0000_migration_race_probe";
    const probeTable = `migration_race_probe_${createdAt}`;
    const migrationStatements = {
      createTable: ["SELECT pg_sleep(0.3);", `CREATE TABLE "${probeTable}" ("id" integer);`],
      alterLockedTable: ["SET lock_timeout = '50ms';", `ALTER TABLE "${probeTable}" ADD COLUMN "added_by_migration" integer;`],
      divideByZero: ["SELECT 1 / 0;"]
    }[input.migration ?? "createTable"];

    writeFileSync(path.join(migrationsFolder, `${tag}.sql`), migrationStatements.join("\n--> statement-breakpoint\n"));
    mkdirSync(path.join(migrationsFolder, "meta"));
    writeFileSync(
      path.join(migrationsFolder, "meta", "_journal.json"),
      JSON.stringify({ version: "7", dialect: "postgresql", entries: [{ idx: 0, version: "7", when: createdAt, tag, breakpoints: true }] })
    );

    const coreConfig = container.resolve(CORE_CONFIG);
    const config = {
      ...coreConfig,
      DRIZZLE_MIGRATIONS_FOLDER: migrationsFolder,
      POSTGRES_DB_URI: input.appDbUri ?? coreConfig.POSTGRES_DB_URI,
      POSTGRES_MIGRATION_DB_URI: input.appDbUri ? coreConfig.POSTGRES_DB_URI : undefined
    };
    const sql = postgres(coreConfig.POSTGRES_DB_URI, { max: 3 });

    let releaseProbeTableLock: (() => Promise<void>) | undefined;
    let releaseHeldMigrationLock: (() => Promise<void>) | undefined;

    onTestFinished(async () => {
      await releaseProbeTableLock?.();
      await releaseHeldMigrationLock?.();
      await sql.end();
      rmSync(migrationsFolder, { recursive: true, force: true });
    });

    const countProbeMigrationRuns = async () => {
      const [{ count }] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations WHERE created_at = ${createdAt}`;
      return count;
    };

    const holdLockOnProbeTable = async () => {
      await sql.unsafe(`CREATE TABLE "${probeTable}" ("id" integer)`);
      const holder = await sql.reserve();
      await holder`BEGIN`;
      await holder.unsafe(`LOCK TABLE "${probeTable}" IN ACCESS SHARE MODE`);
      releaseProbeTableLock = once(async () => {
        await holder`COMMIT`;
        holder.release();
      });
      return releaseProbeTableLock;
    };

    const listProbeTableColumns = async () => {
      const columns = await sql<
        { column_name: string }[]
      >`SELECT column_name FROM information_schema.columns WHERE table_name = ${probeTable} ORDER BY ordinal_position`;
      return columns.map(column => column.column_name);
    };

    const migrationLockFilter = () => sql`locktype = 'advisory' AND ((classid::bigint << 32) | objid::bigint) = ${MIGRATION_ADVISORY_LOCK_KEY}`;

    const terminateMigrationSessionAfterFailedAttempt = async () => {
      const pid = await vi.waitFor(
        async () => {
          const [session] = await sql<{ pid: number }[]>`
            SELECT activity.pid FROM pg_locks locks JOIN pg_stat_activity activity USING (pid)
            WHERE ${migrationLockFilter()} AND locks.granted AND activity.state = 'idle' AND activity.query = 'rollback'`;
          expect(session).toBeDefined();
          return session.pid;
        },
        { timeout: 5_000, interval: 20 }
      );
      await sql`SELECT pg_terminate_backend(${pid})`;
    };

    const holdMigrationLock = async () => {
      const holder = await sql.reserve();
      await holder`SELECT pg_advisory_lock(${MIGRATION_ADVISORY_LOCK_KEY})`;
      releaseHeldMigrationLock = once(async () => {
        await holder`SELECT pg_advisory_unlock(${MIGRATION_ADVISORY_LOCK_KEY})`;
        holder.release();
      });
      return releaseHeldMigrationLock;
    };

    const waitForMigrationLockRequest = () =>
      vi.waitFor(
        async () => {
          const [{ count }] = await sql<{ count: number }[]>`SELECT count(*)::int AS count FROM pg_locks WHERE ${migrationLockFilter()} AND NOT granted`;
          expect(count).toBe(1);
        },
        { timeout: 5_000, interval: 20 }
      );

    return {
      config,
      countProbeMigrationRuns,
      holdLockOnProbeTable,
      listProbeTableColumns,
      terminateMigrationSessionAfterFailedAttempt,
      holdMigrationLock,
      waitForMigrationLockRequest
    };
  }
});

describe("POSTGRES_DB", () => {
  it("keeps the prepare setting from the connection URI when POSTGRES_PREPARE is unset", () => {
    const { client } = setup({ uriPrepare: "false" });

    expect(client.options.prepare).toBe(false);
  });

  it("lets POSTGRES_PREPARE override the prepare setting from the connection URI", () => {
    const { client } = setup({ uriPrepare: "false", POSTGRES_PREPARE: true });

    expect(client.options.prepare).toBe(true);
  });

  function setup(input: { uriPrepare: string; POSTGRES_PREPARE?: boolean }) {
    const coreConfig = container.resolve(CORE_CONFIG);
    const uri = new URL(coreConfig.POSTGRES_DB_URI);
    uri.searchParams.set("prepare", input.uriPrepare);

    const childContainer = container.createChildContainer();
    childContainer.register(CORE_CONFIG, { useValue: { ...coreConfig, POSTGRES_DB_URI: uri.toString(), POSTGRES_PREPARE: input.POSTGRES_PREPARE } });
    const client = childContainer.resolve(POSTGRES_DB).$client;

    onTestFinished(() => client.end());

    return { client };
  }
});
