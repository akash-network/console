import { round } from "../math";

export function getTodayUTC() {
  const currentDate = toUTC(new Date());
  currentDate.setUTCHours(0, 0, 0, 0);

  return currentDate;
}

export function toUTC(date: Date) {
  const now_utc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds());

  return new Date(now_utc);
}

/** `Intl.supportedValuesOf("timeZone")` omits zones browsers report, such as `UTC` and `Asia/Kolkata`. */
export function isSupportedTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Intl also accepts UTC offsets such as `+05:00`, which name no zone. */
const UTC_OFFSET = /^[+-]/;

/** The canonical IANA name of a timezone, such as `UTC` for `Etc/UTC`, or `undefined` when it names no zone the runtime knows. */
export function toIanaTimeZone(timeZone: string): string | undefined {
  if (UTC_OFFSET.test(timeZone) || !isSupportedTimeZone(timeZone)) return undefined;

  return new Intl.DateTimeFormat(undefined, { timeZone }).resolvedOptions().timeZone;
}

export function getPrettyTime(timeMs: number): string {
  if (timeMs < 10) {
    return `${round(timeMs, 2)}ms`;
  } else if (timeMs < 1_000) {
    return `${round(timeMs, 0)}ms`;
  } else if (timeMs < 60 * 1_000) {
    return `${round(timeMs / 1_000, 2)}s`;
  } else if (timeMs < 60 * 60 * 1_000) {
    return `${Math.floor(timeMs / 1_000 / 60)}m ${Math.round((timeMs / 1000) % 60)}s`;
  } else {
    return `${Math.floor(timeMs / 1_000 / 60 / 60)}h ${Math.floor(timeMs / 1_000 / 60) % 60}m`;
  }
}
