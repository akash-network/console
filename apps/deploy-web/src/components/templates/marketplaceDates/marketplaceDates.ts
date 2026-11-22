/** Written in UTC so a page the server rendered reads the same once the visitor's browser takes it over, whatever its time zone. */
const CALENDAR_DAY = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
const CALENDAR_MONTH = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", year: "numeric" });

export function formatCalendarDay(isoDate: string): string {
  return CALENDAR_DAY.format(new Date(isoDate));
}

export function formatCalendarMonth(isoDate: string): string {
  return CALENDAR_MONTH.format(new Date(isoDate));
}

const RELATIVE_TIME = new Intl.RelativeTimeFormat("en-US", { numeric: "always" });

const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Counted in fixed lengths rather than calendar days, which shift with the reader's daylight saving time. */
const ELAPSED_UNITS: { unit: Intl.RelativeTimeFormatUnit; lengthMs: number }[] = [
  { unit: "year", lengthMs: 365 * DAY_MS },
  { unit: "month", lengthMs: 30 * DAY_MS },
  { unit: "day", lengthMs: DAY_MS },
  { unit: "hour", lengthMs: HOUR_MS },
  { unit: "minute", lengthMs: MINUTE_MS }
];
const SECONDS = { unit: "second", lengthMs: SECOND_MS } as const;

/** Measured from when the data was read, not from the clock, so the server's render and the browser's first one say the same thing. */
export function formatTimeSince(isoDate: string, readAt: number): string {
  const elapsedMs = Math.max(0, readAt - Date.parse(isoDate));
  const { unit, lengthMs } = ELAPSED_UNITS.find(({ lengthMs }) => elapsedMs >= lengthMs) ?? SECONDS;
  return RELATIVE_TIME.format(-Math.round(elapsedMs / lengthMs), unit);
}
