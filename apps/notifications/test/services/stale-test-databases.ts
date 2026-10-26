import { Client } from "pg";

/** The names TestDatabaseService gives per-file databases; the 13 digits are the millisecond the run started. */
const PER_FILE_DATABASE_PATTERN = "^test_(?:event_broker|notifications)_([0-9]{13})_";

/** A per-file database outlives its test file only when the run was killed before afterAll. No test file runs this long. */
const PER_FILE_DATABASE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

/** Every DROP DATABASE forces a checkpoint, so a large backlog is worked off a little per run instead of stalling one. */
const SWEEP_TIME_BUDGET_MS = 5_000;

export function staleCutoff(now: Date): Date {
  return new Date(now.getTime() - PER_FILE_DATABASE_MAX_AGE_MS);
}

/**
 * Drops test databases that killed runs left behind. Never fails the run: if Postgres is unreachable or refuses
 * the sweep, the per-file setup reports the real problem and the next run tries again.
 */
export async function sweepStaleTestDatabases(postgresUri: string): Promise<void> {
  const deadline = Date.now() + SWEEP_TIME_BUDGET_MS;
  const admin = new Client({ connectionString: postgresUri, connectionTimeoutMillis: SWEEP_TIME_BUDGET_MS });

  try {
    await admin.connect();
    await dropDatabases(admin, await findStaleTestDatabases(admin, staleCutoff(new Date())), deadline);
  } catch (error) {
    console.warn("Skipped dropping stale test databases:", error);
  } finally {
    await admin.end().catch(() => {});
  }
}

/** Lists per-file test databases whose run started before the cutoff and that nobody is connected to, oldest run first. */
export async function findStaleTestDatabases(admin: Client, cutoff: Date): Promise<string[]> {
  const { rows } = await admin.query<{ datname: string }>(
    `
      SELECT datname
      FROM (
        SELECT d.datname, to_timestamp(substring(d.datname FROM $1)::bigint / 1000.0) AS started_at
        FROM pg_database d
        WHERE d.datname ~ $1
          AND NOT EXISTS (SELECT 1 FROM pg_stat_activity a WHERE a.datname = d.datname)
      ) candidates
      WHERE started_at < $2
      ORDER BY started_at
    `,
    [PER_FILE_DATABASE_PATTERN, cutoff]
  );

  return rows.map(row => row.datname);
}

/**
 * Drops each database, skipping any that a run connected to after the scan, and starts no new drop after the deadline.
 * Returns the ones it dropped.
 */
export async function dropDatabases(admin: Client, names: string[], deadline = Number.POSITIVE_INFINITY): Promise<string[]> {
  const dropped: string[] = [];

  for (const name of names) {
    if (Date.now() >= deadline) break;

    try {
      // IF EXISTS: nothing serializes sweeps here, so a concurrent run's sweep may have dropped it first.
      await admin.query(`DROP DATABASE IF EXISTS ${admin.escapeIdentifier(name)}`);
      dropped.push(name);
    } catch (error) {
      // Usually a run connected after the scan; a later sweep retries it.
      console.warn(`Skipped dropping stale test database ${name}:`, error);
    }
  }

  return dropped;
}
