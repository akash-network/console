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
  const startsAt = start.getTime();
  const firstDay = zonedParts(startsAt, hours.timeZone);
  let remaining = minutes;

  for (let dayOffset = 0; dayOffset < MAX_DAYS_WALKED; dayOffset++) {
    const { year, month, date } = calendarDayAfter(firstDay, dayOffset);
    const isOpen = hours.days.includes(isoWeekday(year, month, date));
    const opensAt = zonedInstant(year, month, date, hours.startHour, hours.timeZone);
    const closesAt = zonedInstant(year, month, date, hours.endHour, hours.timeZone);

    if (isOpen && startsAt < closesAt) {
      const from = Math.max(startsAt, opensAt);
      const available = (closesAt - from) / MINUTE_MS;

      if (remaining <= available) return new Date(from + remaining * MINUTE_MS);

      remaining -= available;
    }
  }

  throw new Error(`Business hours open on no day within ${MAX_DAYS_WALKED} days`);
}

function calendarDayAfter({ year, month, day }: { year: number; month: number; day: number }, dayOffset: number) {
  const calendarDay = new Date(Date.UTC(year, month - 1, day + dayOffset));

  return { year: calendarDay.getUTCFullYear(), month: calendarDay.getUTCMonth() + 1, date: calendarDay.getUTCDate() };
}

function isoWeekday(year: number, month: number, date: number): number {
  return new Date(Date.UTC(year, month - 1, date)).getUTCDay() || 7;
}

/** Resolves a wall-clock time in the zone to an instant, moving a time that a daylight saving jump skips forward by the jump. */
function zonedInstant(year: number, month: number, date: number, hour: number, timeZone: string): number {
  const wallClock = Date.UTC(year, month - 1, date, hour);
  const beforeJump = wallClock - offsetOf(wallClock - offsetOf(wallClock, timeZone), timeZone);
  const afterJump = wallClock - offsetOf(beforeJump, timeZone);

  return Math.max(beforeJump, afterJump);
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
