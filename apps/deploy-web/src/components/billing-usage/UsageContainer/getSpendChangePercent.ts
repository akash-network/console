import { isToday, parseISO } from "date-fns";

import type { UsageHistory } from "@src/types";

/** Today's row only holds spend up to the latest block, so the comparison uses completed days on both sides. */
export function getSpendChangePercent({
  history,
  previousTotalSpent,
  previousDays
}: {
  history: UsageHistory;
  previousTotalSpent: number | null;
  previousDays: number;
}) {
  const completedDays = history.filter(day => !isToday(parseISO(day.date)));
  if (!previousTotalSpent || completedDays.length === 0) return null;

  const dailyRate = completedDays.reduce((sum, day) => sum + day.dailyUsdSpent, 0) / completedDays.length;
  const previousDailyRate = previousTotalSpent / previousDays;

  return (dailyRate / previousDailyRate - 1) * 100;
}
