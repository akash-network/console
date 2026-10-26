import type postgres from "postgres";

import { TEMPLATE_NAME_PREFIX } from "./test-database-templates";

/** The names TestDatabaseService gives per-file databases: an 8-hex run prefix, then the role and the test file. */
const PER_FILE_DATABASE_PATTERN = "^[0-9a-f]{8}_test_(user|indexer)_";
const TEMPLATE_PATTERN = `^${TEMPLATE_NAME_PREFIX}_(user|indexer)_`;

/** A per-file database outlives its test file only when the run was killed before afterAll. No test file runs this long. */
const PER_FILE_DATABASE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

/** A template no run has started from in a week belongs to migrations that no checkout is testing anymore. */
const TEMPLATE_MAX_IDLE_MS = 7 * 24 * 60 * 60 * 1000;

/** Every DROP DATABASE forces a checkpoint, so a large backlog is worked off a little per run instead of stalling one. */
const SWEEP_TIME_BUDGET_MS = 5_000;

export interface StaleTestDatabaseCriteria {
  perFileCutoff: Date;
  templateCutoff: Date;
  /** The current run's templates, kept however old they are. */
  keepTemplates: string[];
}

export function staleCutoffs(now: Date) {
  return {
    perFileCutoff: new Date(now.getTime() - PER_FILE_DATABASE_MAX_AGE_MS),
    templateCutoff: new Date(now.getTime() - TEMPLATE_MAX_IDLE_MS)
  };
}

/**
 * Drops test databases that killed runs left behind. Never fails the run: if Postgres refuses the sweep
 * (for example because the role can't read database files), the next run tries again.
 */
export async function sweepStaleTestDatabases(admin: postgres.Sql, keepTemplates: string[]) {
  try {
    const deadline = Date.now() + SWEEP_TIME_BUDGET_MS;
    const stale = await findStaleTestDatabases(admin, { ...staleCutoffs(new Date()), keepTemplates });
    await dropDatabases(admin, stale, deadline);
  } catch (error) {
    console.warn("Skipped dropping stale test databases:", error);
  }
}

/**
 * Lists leftover test databases, oldest first. A database's age is its last-used mark (see markLastUsed) or,
 * without one, the time Postgres created it. Databases anyone is connected to are never listed.
 */
export async function findStaleTestDatabases(admin: postgres.Sql, { perFileCutoff, templateCutoff, keepTemplates }: StaleTestDatabaseCriteria) {
  const rows = await admin<{ datname: string }[]>`
    WITH candidates AS (
      SELECT d.oid, d.datname, d.datname ~ ${TEMPLATE_PATTERN} AS is_template, shobj_description(d.oid, 'pg_database') AS mark
      FROM pg_database d
      WHERE (d.datname ~ ${PER_FILE_DATABASE_PATTERN} OR d.datname ~ ${TEMPLATE_PATTERN})
        AND NOT EXISTS (SELECT 1 FROM pg_stat_activity a WHERE a.datname = d.datname)
    ), aged AS (
      SELECT
        datname,
        is_template,
        coalesce(
          CASE WHEN mark ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T' THEN mark::timestamptz END,
          (pg_stat_file('base/' || oid || '/PG_VERSION', true)).modification
        ) AS last_used
      FROM candidates
    )
    SELECT datname
    FROM aged
    WHERE last_used < CASE WHEN is_template THEN ${templateCutoff}::timestamptz ELSE ${perFileCutoff}::timestamptz END
    ORDER BY last_used
  `;

  return rows.map(row => row.datname).filter(name => !keepTemplates.includes(name));
}

/**
 * Drops each database, skipping any that a run connected to after the scan, and starts no new drop after the deadline.
 * Returns the ones it dropped.
 */
export async function dropDatabases(admin: postgres.Sql, names: string[], deadline = Number.POSITIVE_INFINITY) {
  const dropped: string[] = [];

  for (const name of names) {
    if (Date.now() >= deadline) break;

    try {
      await admin`ALTER DATABASE ${admin(name)} WITH IS_TEMPLATE false ALLOW_CONNECTIONS true`;
      await admin`DROP DATABASE ${admin(name)}`;
      dropped.push(name);
    } catch {
      // A run connected after the scan; a later sweep will retry it.
    }
  }

  return dropped;
}

/** Stamps a template with when a run last started from it, so a sweep can tell an abandoned template from a long-lived one. */
export async function markLastUsed(admin: postgres.Sql, name: string, at = new Date()) {
  // COMMENT takes no bind parameters; the name is escaped and the ISO timestamp holds no quotes.
  await admin.unsafe(`COMMENT ON DATABASE "${name.replaceAll('"', '""')}" IS '${at.toISOString()}'`);
}
