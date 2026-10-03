import { differenceInCalendarDays, endOfDay, startOfDay, subDays, subYears } from "date-fns";

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
