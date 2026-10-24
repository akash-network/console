import { differenceInCalendarDays, endOfDay, format, startOfDay, subDays, subYears } from "date-fns";
import { millisecondsInSecond, secondsInDay } from "date-fns/constants";

import type { SpendRange } from "@src/types/project-budget";

export const USAGE_DATE_PRESETS = [
  { value: "last7Days", label: "Last 7 days" },
  { value: "last30Days", label: "Last 30 days" },
  { value: "last90Days", label: "Last 90 days" },
  { value: "last12Months", label: "Last 12 months" },
  { value: "custom", label: "Custom range" }
] as const;

export type UsageDatePreset = (typeof USAGE_DATE_PRESETS)[number]["value"];

export type UsageDateRange = { from: Date; to: Date };

export const DEFAULT_USAGE_DATE_PRESET = "last30Days" satisfies UsageDatePreset;

const MILLISECONDS_IN_DAY = secondsInDay * millisecondsInSecond;

const PRESET_STARTS: Record<Exclude<UsageDatePreset, "custom">, (today: Date) => Date> = {
  last7Days: today => subDays(today, 6),
  last30Days: today => subDays(today, 29),
  last90Days: today => subDays(today, 89),
  last12Months: today => subYears(today, 1)
};

export function getUsagePresetRange(preset: Exclude<UsageDatePreset, "custom">, now = new Date()): UsageDateRange {
  return { from: PRESET_STARTS[preset](startOfDay(now)), to: endOfDay(now) };
}

export function countDaysInRange(range: UsageDateRange) {
  return differenceInCalendarDays(range.to, range.from) + 1;
}

export function getPreviousPeriod(range: UsageDateRange): UsageDateRange {
  return { from: startOfDay(subDays(range.from, countDaysInRange(range))), to: endOfDay(subDays(range.from, 1)) };
}

/** Spend is counted per UTC day, so a range running to now ends on today's UTC date, which west of UTC is a day past the local one every evening. */
export function toSpendRange(range: UsageDateRange, now = new Date()): SpendRange {
  if (range.to < now) {
    return { startDate: format(range.from, "yyyy-MM-dd"), endDate: format(range.to, "yyyy-MM-dd") };
  }

  const endDate = now.toISOString().slice(0, 10);

  return { startDate: addUtcDays(endDate, 1 - countWholeDays(range)), endDate };
}

export function getPreviousSpendRange({ startDate, endDate }: SpendRange): SpendRange {
  const days = (Date.parse(endDate) - Date.parse(startDate)) / MILLISECONDS_IN_DAY + 1;

  return { startDate: addUtcDays(startDate, -days), endDate: addUtcDays(startDate, -1) };
}

/** Counted from the instants rather than calendar dates, so the length is the same in every time zone. */
function countWholeDays({ from, to }: UsageDateRange): number {
  return Math.round((to.getTime() - from.getTime()) / MILLISECONDS_IN_DAY);
}

function addUtcDays(date: string, days: number): string {
  return new Date(Date.parse(date) + days * MILLISECONDS_IN_DAY).toISOString().slice(0, 10);
}
