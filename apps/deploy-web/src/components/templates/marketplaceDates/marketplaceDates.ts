import { formatDistanceStrict } from "date-fns";

/** Written in UTC so a page the server rendered reads the same once the visitor's browser takes it over, whatever its time zone. */
const CALENDAR_DAY = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
const CALENDAR_MONTH = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", year: "numeric" });

export function formatCalendarDay(isoDate: string): string {
  return CALENDAR_DAY.format(new Date(isoDate));
}

export function formatCalendarMonth(isoDate: string): string {
  return CALENDAR_MONTH.format(new Date(isoDate));
}

/** Measured from when the data was read, not from the clock, so the server's render and the browser's first one say the same thing. */
export function formatTimeSince(isoDate: string, readAt: number): string {
  const then = new Date(isoDate);
  return formatDistanceStrict(then, new Date(Math.max(readAt, then.getTime())), { addSuffix: true });
}
