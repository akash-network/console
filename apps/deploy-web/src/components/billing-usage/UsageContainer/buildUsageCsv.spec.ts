import { describe, expect, it } from "vitest";

import { buildProjectUsageCsv, buildUsageCsv } from "./buildUsageCsv";

import { buildUsageHistoryItem, buildUsageHistoryStats } from "@tests/seeders/usage";

describe(buildUsageCsv.name, () => {
  it("lists the stats and then each day's spend in every denom", () => {
    const csv = buildUsageCsv(
      [
        buildUsageHistoryItem({
          date: "2026-10-01",
          activeDeployments: 2,
          dailyAktSpent: 1,
          totalAktSpent: 3,
          dailyActSpent: 4,
          totalActSpent: 5,
          dailyUsdSpent: 6,
          totalUsdSpent: 7
        }),
        buildUsageHistoryItem({
          date: "2026-10-02",
          activeDeployments: 1,
          dailyAktSpent: 0,
          totalAktSpent: 3,
          dailyActSpent: 2,
          totalActSpent: 7,
          dailyUsdSpent: 2.5,
          totalUsdSpent: 9.5
        })
      ],
      buildUsageHistoryStats({ totalSpent: 8.5, averageSpentPerDay: 4.25, totalDeployments: 2, averageDeploymentsPerDay: 1 })
    );

    expect(csv).toBe(
      [
        "Usage Stats",
        "Total Spent,Average Spent Per Day,Total Deployments,Average Deployments Per Day",
        "8.5,4.25,2,1",
        "Usage History",
        "Date,Active Deployments,Daily AKT Spent,Total AKT Spent,Daily ACT Spent,Total ACT Spent,Daily USD Spent,Total USD Spent",
        "2026-10-01,2,1,3,4,5,6,7",
        "2026-10-02,1,0,3,2,7,2.5,9.5"
      ].join("\n")
    );
  });

  it("quotes a cell that contains a comma", () => {
    const csv = buildUsageCsv([buildUsageHistoryItem({ date: "Oct 1, 2026" })], buildUsageHistoryStats());

    expect(csv.split("\n")[5]).toMatch(/^"Oct 1, 2026",/);
  });
});

describe(buildProjectUsageCsv.name, () => {
  it("lists the stats and then each day's USD spend with its running total, all to the cent", () => {
    const csv = buildProjectUsageCsv(
      [
        { date: "2026-10-01", dailyUsdSpent: 0.1 },
        { date: "2026-10-02", dailyUsdSpent: 0.2 },
        { date: "2026-10-03", dailyUsdSpent: 0 }
      ],
      buildUsageHistoryStats({ totalSpent: 0.3, averageSpentPerDay: 0.3 / 3, totalDeployments: 2, averageDeploymentsPerDay: 2 / 3 })
    );

    expect(csv).toBe(
      [
        "Usage Stats",
        "Total Spent,Average Spent Per Day,Total Deployments,Average Deployments Per Day",
        "0.3,0.1,2,0.67",
        "Usage History",
        "Date,Daily USD Spent,Total USD Spent",
        "2026-10-01,0.1,0.1",
        "2026-10-02,0.2,0.3",
        "2026-10-03,0,0.3"
      ].join("\n")
    );
  });
});
