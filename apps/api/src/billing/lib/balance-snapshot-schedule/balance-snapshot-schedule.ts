const DAY_MS = 24 * 60 * 60 * 1000;

/** Past midnight UTC, so the day a snapshot is filed under is the day it was read on. */
const SNAPSHOT_MINUTES_AFTER_MIDNIGHT_UTC = 15;

export function nextBalanceSnapshotRunAt(now: Date): Date {
  const todaysRun = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + SNAPSHOT_MINUTES_AFTER_MIDNIGHT_UTC * 60 * 1000;

  return new Date(todaysRun > now.getTime() ? todaysRun : todaysRun + DAY_MS);
}

export function utcDayOf(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}
