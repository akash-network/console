import { endOfDay, startOfDay, subDays, subMonths, subYears } from "date-fns";

export const HISTORY_DATE_PRESETS = [
  { value: "last30Days", label: "Last 30 days" },
  { value: "last3Months", label: "Last 3 months" },
  { value: "last12Months", label: "Last 12 months" },
  { value: "custom", label: "Custom range" }
] as const;

export type HistoryDatePreset = (typeof HISTORY_DATE_PRESETS)[number]["value"];

export type HistoryDateRange = { from: Date; to: Date };

export const DEFAULT_HISTORY_DATE_PRESET = "last3Months" satisfies HistoryDatePreset;

const PRESET_STARTS: Record<Exclude<HistoryDatePreset, "custom">, (today: Date) => Date> = {
  last30Days: today => subDays(today, 29),
  last3Months: today => subMonths(today, 3),
  last12Months: today => subYears(today, 1)
};

export function getHistoryPresetRange(preset: Exclude<HistoryDatePreset, "custom">, now = new Date()): HistoryDateRange {
  return { from: PRESET_STARTS[preset](startOfDay(now)), to: endOfDay(now) };
}
