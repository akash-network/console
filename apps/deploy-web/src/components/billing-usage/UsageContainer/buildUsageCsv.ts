import type { UsageHistory, UsageHistoryStats } from "@src/types";
import { sanitizeCsvField } from "@src/utils/stringUtils";

export function buildUsageCsv(history: UsageHistory, stats: UsageHistoryStats) {
  const statsRows = [
    "Usage Stats",
    "Total Spent,Average Spent Per Day,Total Deployments,Average Deployments Per Day",
    toCsvRow([stats.totalSpent, stats.averageSpentPerDay, stats.totalDeployments, stats.averageDeploymentsPerDay])
  ];

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

  return [...statsRows, ...historyRows].join("\n");
}

function toCsvRow(cells: Array<string | number>) {
  return cells.map(sanitizeCsvField).join(",");
}
