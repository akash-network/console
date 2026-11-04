export type BusinessHours = {
  timeZone: string;
  /** ISO weekdays, Monday being 1 and Sunday 7. */
  days: number[];
  startHour: number;
  endHour: number;
};

const MINUTE_MS = 60_000;

/** Bounds the walk across closed days, so a calendar with no open day can't loop forever. */
const MAX_DAYS_WALKED = 400;

export function isTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Counts only the minutes inside the opening hours, so a request filed on Friday evening comes due on Monday. */
export function addBusinessMinutes(start: Date, minutes: number, hours: BusinessHours): Date {
  let cursor = start.getTime();
  let remaining = minutes;

  for (let day = 0; day < MAX_DAYS_WALKED; day++) {
    const { year, month, day: date } = zonedParts(cursor, hours.timeZone);
    const isOpen = hours.days.includes(isoWeekday(year, month, date));
    const opensAt = zonedInstant(year, month, date, hours.startHour, hours.timeZone);
    const closesAt = zonedInstant(year, month, date, hours.endHour, hours.timeZone);

    if (isOpen && cursor < closesAt) {
      const from = Math.max(cursor, opensAt);
      const available = (closesAt - from) / MINUTE_MS;

      if (remaining <= available) return new Date(from + remaining * MINUTE_MS);

      remaining -= available;
    }

    cursor = zonedInstant(year, month, date + 1, 0, hours.timeZone);
  }

  throw new Error(`Business hours open on no day within ${MAX_DAYS_WALKED} days`);
}

function isoWeekday(year: number, month: number, date: number): number {
  return new Date(Date.UTC(year, month - 1, date)).getUTCDay() || 7;
}

/** Resolves a wall-clock time in the zone to an instant, re-reading the offset once so a DST change between the guess and the answer is honoured. */
function zonedInstant(year: number, month: number, date: number, hour: number, timeZone: string): number {
  const wallClock = Date.UTC(year, month - 1, date, hour);
  const guess = wallClock - offsetOf(wallClock, timeZone);

  return wallClock - offsetOf(guess, timeZone);
}

function offsetOf(instant: number, timeZone: string): number {
  const { year, month, day, hour, minute, second } = zonedParts(instant, timeZone);

  return Date.UTC(year, month - 1, day, hour, minute, second) - instant;
}

function zonedParts(instant: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric"
  }).formatToParts(instant);
  const valueOf = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(part => part.type === type)?.value);

  return { year: valueOf("year"), month: valueOf("month"), day: valueOf("day"), hour: valueOf("hour"), minute: valueOf("minute"), second: valueOf("second") };
}
