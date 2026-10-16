import { describe, expect, it, vi } from "vitest";

import type { DeploymentSpendReport } from "@src/types/deployment-spend";
import { perBlockToHourly } from "@src/utils/priceUtils";
import { hourlyRateOf, isInScope, projectSeriesOf, scopeUsage } from "./teamUsage";

describe(scopeUsage.name, () => {
  it("adds up every project and the unassigned spend of each day for the whole organization", () => {
    const usage = scopeUsage(buildReport(), null);

    expect(usage.dailySpend).toEqual([
      { date: "2026-02-27", dailyUsdSpent: 1.3, spendBySeries: { storefront: 1.1, unassigned: 0.2 } },
      { date: "2026-02-28", dailyUsdSpent: 0, spendBySeries: {} },
      { date: "2026-03-01", dailyUsdSpent: 2.5, spendBySeries: { storefront: 2, marketing: 0.5 } }
    ]);
    expect(usage.stats).toEqual({ totalSpent: 3.8, averageSpentPerDay: 3.8 / 3, totalDeployments: 3, averageDeploymentsPerDay: 1 });
    expect(usage.dseqs).toEqual(["1", "2", "3"]);
  });

  it("keeps only the spend and deployments of the project the page is narrowed to", () => {
    const usage = scopeUsage(buildReport(), "storefront");

    expect(usage.dailySpend.map(({ dailyUsdSpent }) => dailyUsdSpent)).toEqual([1.1, 0, 2]);
    expect(usage.dailySpend[2].spendBySeries).toEqual({ storefront: 2 });
    expect(usage.stats).toEqual({ totalSpent: 3.1, averageSpentPerDay: 3.1 / 3, totalDeployments: 1, averageDeploymentsPerDay: 1 / 3 });
    expect(usage.dseqs).toEqual(["1"]);
  });

  it("gives a one-day range a single bar", () => {
    const usage = scopeUsage(buildReport({ startDate: "2026-03-01", endDate: "2026-03-01" }), null);

    expect(usage.dailySpend).toEqual([{ date: "2026-03-01", dailyUsdSpent: 2.5, spendBySeries: { storefront: 2, marketing: 0.5 } }]);
  });
});

describe(projectSeriesOf.name, () => {
  it("lists the projects and the unassigned deployments that spent in the range, biggest spender first", () => {
    const series = projectSeriesOf(buildReport(), vi.fn());

    expect(series.map(({ key, label }) => ({ key, label }))).toEqual([
      { key: "storefront", label: "Storefront" },
      { key: "marketing", label: "Marketing" },
      { key: "unassigned", label: "Unassigned" }
    ]);
    expect(series[2].onSelect).toBeUndefined();
  });

  it("narrows the page to the project of the series picked", () => {
    const onSelect = vi.fn();

    projectSeriesOf(buildReport(), onSelect)[1].onSelect!();

    expect(onSelect).toHaveBeenCalledWith("marketing");
  });

  it("labels a deleted project that spent in the range and offers no way to narrow to it", () => {
    const report = buildReport();
    report.projects[1] = { ...report.projects[1], name: "Old storefront", isDeleted: true };

    const series = projectSeriesOf(report, vi.fn());

    expect(series[0]).toEqual({ key: "storefront", label: "Old storefront (deleted)" });
  });
});

function buildReport(range: Pick<DeploymentSpendReport, "startDate" | "endDate"> = { startDate: "2026-02-27", endDate: "2026-03-01" }): DeploymentSpendReport {
  return {
    ...range,
    projects: [
      { projectId: "marketing", name: "Marketing", isDefault: true, isDeleted: false },
      { projectId: "storefront", name: "Storefront", isDefault: false, isDeleted: false },
      { projectId: "idle", name: "Idle", isDefault: false, isDeleted: false }
    ],
    days: [
      { date: "2026-02-27", projectId: "storefront", consumedUsd: 1.1 },
      { date: "2026-02-27", projectId: null, consumedUsd: 0.2 },
      { date: "2026-03-01", projectId: "storefront", consumedUsd: 2 },
      { date: "2026-03-01", projectId: "marketing", consumedUsd: 0.5 }
    ],
    deployments: [
      { dseq: "1", name: "web", projectId: "storefront", consumedUsd: 3.1, hours: 48 },
      { dseq: "2", name: null, projectId: "marketing", consumedUsd: 0.5, hours: 5 },
      { dseq: "3", name: null, projectId: null, consumedUsd: 0.2, hours: 2 }
    ]
  };
}

describe(isInScope.name, () => {
  it("counts every project and the unassigned spend in the whole organization", () => {
    expect(isInScope("storefront", null)).toBe(true);
    expect(isInScope(null, null)).toBe(true);
  });

  it("counts only the project the page is narrowed to", () => {
    expect(isInScope("storefront", "storefront")).toBe(true);
    expect(isInScope("marketing", "storefront")).toBe(false);
    expect(isInScope(null, "storefront")).toBe(false);
  });
});

describe(hourlyRateOf.name, () => {
  it("adds up the per-block cost of the given deployments that are running", () => {
    const perBlockUsdByDseq = new Map([
      ["1", 0.002],
      ["2", 0.003],
      ["3", 0.5]
    ]);

    expect(hourlyRateOf(perBlockUsdByDseq, ["1", "2", "4"])).toBeCloseTo(perBlockToHourly(0.005), 10);
  });
});
