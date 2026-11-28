const DAY_MS = 24 * 60 * 60 * 1000;

/** Past midnight UTC, so the day a snapshot is filed under is the day it was read on. */
const SNAPSHOT_MINUTES_AFTER_MIDNIGHT_UTC = 15;

export function nextBalanceSnapshotRunAt(now: Date): Date {
  const today = utcDayOf(now);
  const todaysRun = balanceSnapshotRunAtOn(today);

  return todaysRun > now ? todaysRun : balanceSnapshotRunAtOn(utcDayAfter(today));
}

export function balanceSnapshotRunAtOn(utcDay: string): Date {
  return new Date(startOfUtcDay(utcDay) + SNAPSHOT_MINUTES_AFTER_MIDNIGHT_UTC * 60 * 1000);
}

export function utcDayOf(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}

export function utcDayAfter(utcDay: string): string {
  return utcDayOf(new Date(startOfUtcDay(utcDay) + DAY_MS));
}

function startOfUtcDay(utcDay: string): number {
  return Date.parse(`${utcDay}T00:00:00.000Z`);
}
