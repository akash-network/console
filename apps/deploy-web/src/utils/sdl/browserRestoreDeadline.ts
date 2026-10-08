/** The last moment, in UTC, the update tab offers to restore protected variables from this browser's copy of a deployment. */
export const BROWSER_RESTORE_LAST_DAY = new Date("2026-11-09T23:59:59.999Z");

export function isBrowserRestoreOffered(now: Date): boolean {
  return now.getTime() <= BROWSER_RESTORE_LAST_DAY.getTime();
}
