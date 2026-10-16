import type { DailySpend } from "@src/components/billing-usage/DailySpendChart/DailySpendChart";
import type { UsageHistory, UsageHistoryStats } from "@src/types";
import { roundDecimal } from "@src/utils/mathHelpers";
import { sanitizeCsvField } from "@src/utils/stringUtils";

export function buildUsageCsv(history: UsageHistory, stats: UsageHistoryStats) {
  const historyRows = [
    "Usage History",
    "Date,Active Deployments,Daily AKT Spent,Total AKT Spent,Daily ACT Spent,Total ACT Spent,Daily USD Spent,Total USD Spent",
    ...history.map(day =>
      toCsvRow([
        day.date,
        day.activeDeployments,
        day.dailyAktSpent,
        day.totalAktSpent,
        day.dailyActSpent,
        day.totalActSpent,
        day.dailyUsdSpent,
        day.totalUsdSpent
      ])
    )
  ];

  return [...statsRowsOf(stats), ...historyRows].join("\n");
}

/** A project's spend is read in USD alone, so its history keeps only the USD columns of the organization's export. */
export function buildProjectUsageCsv(dailySpend: DailySpend[], stats: UsageHistoryStats) {
  let totalUsdSpent = 0;
  const historyRows = dailySpend.map(({ date, dailyUsdSpent }) => {
    totalUsdSpent = roundDecimal(totalUsdSpent + dailyUsdSpent);
    return toCsvRow([date, dailyUsdSpent, totalUsdSpent]);
  });

  return [...statsRowsOf(stats), "Usage History", "Date,Daily USD Spent,Total USD Spent", ...historyRows].join("\n");
}

function statsRowsOf(stats: UsageHistoryStats) {
  return [
    "Usage Stats",
    "Total Spent,Average Spent Per Day,Total Deployments,Average Deployments Per Day",
    toCsvRow([stats.totalSpent, stats.averageSpentPerDay, stats.totalDeployments, stats.averageDeploymentsPerDay])
  ];
}

function toCsvRow(cells: Array<string | number>) {
  return cells.map(sanitizeCsvField).join(",");
}
