import { describe, expect, it } from "vitest";

import type { DeploymentSpendReport } from "@src/types/deployment-spend";
import { perBlockToHourly } from "@src/utils/priceUtils";
import { hourlyRateOf, isInScope, scopeUsage } from "./teamUsage";

describe(scopeUsage.name, () => {
  it("adds up every project and the unassigned spend of each day for the whole organization", () => {
    const usage = scopeUsage(buildReport(), null);

    expect(usage.dailySpend).toEqual([
      { date: "2026-02-27", dailyUsdSpent: 1.3 },
      { date: "2026-02-28", dailyUsdSpent: 0 },
      { date: "2026-03-01", dailyUsdSpent: 2.5 }
    ]);
    expect(usage.stats).toEqual({ totalSpent: 3.8, averageSpentPerDay: 3.8 / 3, totalDeployments: 3, averageDeploymentsPerDay: 1 });
    expect(usage.dseqs).toEqual(["1", "2", "3"]);
  });

  it("keeps only the spend and deployments of the project the page is narrowed to", () => {
    const usage = scopeUsage(buildReport(), "storefront");

    expect(usage.dailySpend.map(({ dailyUsdSpent }) => dailyUsdSpent)).toEqual([1.1, 0, 2]);
    expect(usage.stats).toEqual({ totalSpent: 3.1, averageSpentPerDay: 3.1 / 3, totalDeployments: 1, averageDeploymentsPerDay: 1 / 3 });
    expect(usage.dseqs).toEqual(["1"]);
  });

  it("gives a one-day range a single bar", () => {
    const usage = scopeUsage(buildReport({ startDate: "2026-03-01", endDate: "2026-03-01" }), null);

    expect(usage.dailySpend).toEqual([{ date: "2026-03-01", dailyUsdSpent: 2.5 }]);
  });

  function buildReport(
    range: Pick<DeploymentSpendReport, "startDate" | "endDate"> = { startDate: "2026-02-27", endDate: "2026-03-01" }
  ): DeploymentSpendReport {
    return {
      ...range,
      projects: [],
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
});

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
