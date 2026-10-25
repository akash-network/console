import type { DailySpend } from "@src/components/billing-usage/DailySpendChart/DailySpendChart";
import { getDayStr } from "@src/utils/dateUtils";

/** Rows are UTC days and today's only holds spend up to the latest block, so the comparison uses completed days on both sides. */
export function getSpendChangePercent({
  history,
  previousTotalSpent,
  previousDays
}: {
  history: DailySpend[];
  previousTotalSpent: number | null;
  previousDays: number;
}) {
  const today = getDayStr();
  const completedDays = history.filter(day => day.date !== today);
  if (!previousTotalSpent || completedDays.length === 0) return null;

  const dailyRate = completedDays.reduce((sum, day) => sum + day.dailyUsdSpent, 0) / completedDays.length;
  const previousDailyRate = previousTotalSpent / previousDays;

  return (dailyRate / previousDailyRate - 1) * 100;
}
