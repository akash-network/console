import { describe, expect, it, vi } from "vitest";

import { spendShade } from "@src/components/billing-usage/spendShade";
import type { DeploymentSpend, DeploymentSpendReport } from "@src/types/deployment-spend";
import { perBlockToHourly } from "@src/utils/priceUtils";
import { deploymentRowsOf, hourlyRateOf, isInScope, projectSeriesOf, projectSpendRowsOf, scopeUsage } from "./teamUsage";

import { buildProjectSpend, buildProjectSpendReport, buildSpendAmounts } from "@tests/seeders/projectSpend";

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

  it("adds up the gpu hours of every deployment and lists each of their models once", () => {
    const usage = scopeUsage(buildReportWithGpuUsage(), null);

    expect(usage.stats).toMatchObject({ gpuHours: 8.5, gpuModels: ["A100", "H100"] });
  });

  it("keeps only the gpu hours of the project the page is narrowed to", () => {
    const usage = scopeUsage(buildReportWithGpuUsage(), "storefront");

    expect(usage.stats).toMatchObject({ gpuHours: 6, gpuModels: ["H100"] });
  });

  it("reports no gpu hours from an api that leaves them out of a deployment", () => {
    const report = buildReportWithGpuUsage();
    report.deployments[2] = buildReport().deployments[2];

    const usage = scopeUsage(report, null);

    expect(usage.stats).not.toHaveProperty("gpuHours");
    expect(usage.stats).not.toHaveProperty("gpuModels");
  });

  it("reports zero gpu hours for a range no deployment ran in", () => {
    const usage = scopeUsage({ ...buildReport(), days: [], deployments: [] }, null);

    expect(usage.stats).toMatchObject({ gpuHours: 0, gpuModels: [] });
  });
});

function buildReportWithGpuUsage(): DeploymentSpendReport {
  const report = buildReport();
  const gpuUsageByDseq: Record<string, Pick<DeploymentSpend, "gpuHours" | "gpuModels">> = {
    "1": { gpuHours: 6, gpuModels: ["H100"] },
    "2": { gpuHours: 2.5, gpuModels: ["H100", "A100"] },
    "3": { gpuHours: 0, gpuModels: [] }
  };

  return { ...report, deployments: report.deployments.map(deployment => ({ ...deployment, ...gpuUsageByDseq[deployment.dseq] })) };
}

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

describe(deploymentRowsOf.name, () => {
  it("lists every deployment of the organization with its project, hourly rate and share of the total", () => {
    expect(deploymentRowsOf(buildReport(), null)).toEqual([
      {
        dseq: "1",
        name: "web",
        projectName: "Storefront",
        hours: 48,
        hourlyRateUsd: 3.1 / 48,
        consumedUsd: 3.1,
        sharePercent: expect.closeTo((3.1 / 3.8) * 100, 10)
      },
      {
        dseq: "2",
        name: null,
        projectName: "Marketing",
        hours: 5,
        hourlyRateUsd: 0.5 / 5,
        consumedUsd: 0.5,
        sharePercent: expect.closeTo((0.5 / 3.8) * 100, 10)
      },
      {
        dseq: "3",
        name: null,
        projectName: "Unassigned",
        hours: 2,
        hourlyRateUsd: 0.2 / 2,
        consumedUsd: 0.2,
        sharePercent: expect.closeTo((0.2 / 3.8) * 100, 10)
      }
    ]);
  });

  it("keeps the deployments of the project the page is narrowed to and shares out its total", () => {
    expect(deploymentRowsOf(buildReport(), "marketing")).toEqual([expect.objectContaining({ dseq: "2", sharePercent: 100 })]);
  });

  it("labels the deployments of a deleted project", () => {
    const report = buildReport();
    report.projects[0] = { ...report.projects[0], isDeleted: true };

    expect(deploymentRowsOf(report, "marketing")[0].projectName).toBe("Marketing (deleted)");
  });

  it("names no project it wasn't given", () => {
    const report = buildReport();
    report.deployments[0] = { ...report.deployments[0], projectId: "elsewhere" };

    expect(deploymentRowsOf(report, null)[0].projectName).toBe("Unknown project");
  });

  it("gives a deployment without hours no rate and a scope without spend no shares", () => {
    const report = buildReport();
    report.deployments = [{ dseq: "4", name: null, projectId: "storefront", consumedUsd: 0, hours: 0 }];

    expect(deploymentRowsOf(report, null)).toEqual([expect.objectContaining({ hourlyRateUsd: 0, sharePercent: 0 })]);
  });
});

describe(projectSpendRowsOf.name, () => {
  it("ranks the projects and the unassigned spend by consumption, with each one's deployments, hours and committed spend", () => {
    const rows = projectSpendRowsOf(buildSpend(), buildReport(), vi.fn());

    expect(rows.map(({ onSelect, ...row }) => row)).toEqual([
      {
        key: "storefront",
        label: "Storefront",
        deploymentCount: 1,
        hours: 48,
        consumedUsd: 3.1,
        committedUsd: 5,
        sharePercent: expect.closeTo((3.1 / 3.8) * 100, 10),
        shade: spendShade(0, 3)
      },
      {
        key: "marketing",
        label: "Marketing",
        deploymentCount: 1,
        hours: 5,
        consumedUsd: 0.5,
        committedUsd: 1,
        sharePercent: expect.closeTo((0.5 / 3.8) * 100, 10),
        shade: spendShade(1, 3)
      },
      {
        key: "unassigned",
        label: "Unassigned",
        deploymentCount: 1,
        hours: 2,
        consumedUsd: 0.2,
        committedUsd: 0,
        sharePercent: expect.closeTo((0.2 / 3.8) * 100, 10),
        shade: spendShade(2, 3)
      },
      { key: "idle", label: "Idle", deploymentCount: 0, hours: 0, consumedUsd: 0, committedUsd: 0, sharePercent: 0, shade: null }
    ]);
    expect(rows[2].onSelect).toBeUndefined();
  });

  it("narrows the page to the project of the row picked", () => {
    const onSelect = vi.fn();

    projectSpendRowsOf(buildSpend(), buildReport(), onSelect)[1].onSelect!();

    expect(onSelect).toHaveBeenCalledWith("marketing");
  });

  it("labels a deleted project and offers no way to narrow to it", () => {
    const spend = buildSpend();
    spend.projects[0] = { ...spend.projects[0], isDeleted: true };

    const marketing = projectSpendRowsOf(spend, buildReport(), vi.fn()).find(({ key }) => key === "marketing");

    expect(marketing).toEqual(expect.objectContaining({ label: "Marketing (deleted)", onSelect: undefined }));
  });

  it("lists the unassigned spend while it holds committed spend alone", () => {
    const rows = projectSpendRowsOf(buildSpend({ unassigned: buildSpendAmounts({ committedUsd: 2 }) }), undefined, vi.fn());

    expect(rows.map(({ key }) => key)).toContain("unassigned");
  });

  it("leaves out unassigned spend that is empty or hidden from the caller", () => {
    const keysOf = (unassigned: ReturnType<typeof buildSpendAmounts> | null) =>
      projectSpendRowsOf(buildSpend({ unassigned }), buildReport(), vi.fn()).map(({ key }) => key);

    expect(keysOf(buildSpendAmounts())).not.toContain("unassigned");
    expect(keysOf(null)).not.toContain("unassigned");
  });

  it("counts no deployment nor shade until the deployments are read, and shares nothing out of no consumption", () => {
    const rows = projectSpendRowsOf(buildProjectSpendReport({ projects: [buildProjectSpend({ projectId: "storefront" })] }), undefined, vi.fn());

    expect(rows).toEqual([expect.objectContaining({ deploymentCount: 0, hours: 0, sharePercent: 0, shade: null })]);
  });

  function buildSpend(overrides: Parameters<typeof buildProjectSpendReport>[0] = {}) {
    return buildProjectSpendReport({
      projects: [
        buildProjectSpend({ projectId: "marketing", name: "Marketing", consumedUsd: 0.5, committedUsd: 1 }),
        buildProjectSpend({ projectId: "idle", name: "Idle" }),
        buildProjectSpend({ projectId: "storefront", name: "Storefront", consumedUsd: 3.1, committedUsd: 5 })
      ],
      unassigned: buildSpendAmounts({ consumedUsd: 0.2 }),
      ...overrides
    });
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
