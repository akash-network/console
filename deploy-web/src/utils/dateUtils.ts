import { roundDecimal } from "./mathHelpers";

export const averageDaysInMonth = 30.437;

export const epochToDate = (epoch: number) => {
  // The 0 sets the date to the epoch
  const d = new Date(0);
  d.setUTCSeconds(epoch);

  return d;
};

export const getDayStr = (date?: Date) => {
  return date ? toUTC(date).toISOString().split("T")[0] : getTodayUTC().toISOString().split("T")[0];
};

export function getTodayUTC() {
  let currentDate = toUTC(new Date());
  currentDate.setUTCHours(0, 0, 0, 0);

  return currentDate;
}

export function startOfDay(date: Date) {
  let currentDate = toUTC(date);
  currentDate.setUTCHours(0, 0, 0, 0);

  return currentDate;
}

export function endOfDay(date: Date) {
  let currentDate = toUTC(date);
  currentDate.setUTCHours(23, 59, 59, 999);

  return currentDate;
}

export function toUTC(date: Date) {
  const now_utc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds());

  return new Date(now_utc);
}

export function getPrettyTime(timeMs: number): string {
  if (timeMs < 10) {
    return `${roundDecimal(timeMs, 2)}ms`;
  } else if (timeMs < 1_000) {
    return `${roundDecimal(timeMs, 0)}ms`;
  } else if (timeMs < 60 * 1_000) {
    return `${roundDecimal(timeMs / 1_000, 2)}s`;
  } else if (timeMs < 60 * 60 * 1_000) {
    return `${Math.floor(timeMs / 1_000 / 60)}m ${roundDecimal((timeMs / 1000) % 60, 2)}s`;
  } else {
    return `${Math.floor(timeMs / 1_000 / 60 / 60)}h ${roundDecimal(timeMs / 1_000 / 60, 2) % 60}m`;
  }
}
