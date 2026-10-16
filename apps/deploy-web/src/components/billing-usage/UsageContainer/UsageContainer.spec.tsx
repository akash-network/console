import React from "react";
import { endOfDay, format, startOfDay, startOfToday, subDays } from "date-fns";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UsageHistory, UsageHistoryStats } from "@src/types";
import type { DeploymentSpendReport } from "@src/types/deployment-spend";
import type { OrganizationOutput, OrganizationRole } from "@src/types/organization";
import type { Project } from "@src/types/project";
import { perBlockToHourly } from "@src/utils/priceUtils";
import { buildUsageCsv } from "./buildUsageCsv";
import { scopeUsage } from "./teamUsage";
import type { ChildrenProps, DEPENDENCIES } from "./UsageContainer";
import { UsageContainer } from "./UsageContainer";
import { getPreviousPeriod, getUsagePresetRange } from "./usageDatePresets";

import { act, render } from "@testing-library/react";
import { buildUsageHistory, buildUsageHistoryItem, buildUsageHistoryStats } from "@tests/seeders/usage";
import { createContainerTestingChildCapturer } from "@tests/unit/container-testing-child-capturer";

describe(UsageContainer.name, () => {
  it("shows the last 30 days by default", async () => {
    const { child, useUsage } = await setup();
    const last30Days = getUsagePresetRange("last30Days");

    expect(child.datePreset).toBe("last30Days");
    expect(child.dateRange).toEqual(last30Days);
    expect(useUsage).toHaveBeenLastCalledWith({ address: "akash1abc", startDate: last30Days.from, endDate: last30Days.to });
  });

  it("passes the usage of the range on screen", async () => {
    const { child, usageHistory, usageStats } = await setup();

    expect(child.usageHistoryData).toBe(usageHistory);
    expect(child.usageHistoryStatsData).toBe(usageStats);
  });

  it("compares the daily spend with the previous period of the same length", async () => {
    const { child, useUsageStats } = await setup({
      usageHistory: [buildDay(2, 10), buildDay(1, 10)],
      previousStats: buildUsageHistoryStats({ totalSpent: 240 })
    });
    const previousPeriod = getPreviousPeriod(getUsagePresetRange("last30Days"));

    expect(useUsageStats).toHaveBeenCalledWith({ address: "akash1abc", startDate: previousPeriod.from, endDate: previousPeriod.to });
    expect(child.spendChangePercent).toBeCloseTo(25, 6);
  });

  it("has no spend comparison until the previous period loads", async () => {
    const { child } = await setup({ usageHistory: [buildDay(1, 10)], previousStats: undefined });

    expect(child.spendChangePercent).toBeNull();
  });

  it("allows the export once the usage has loaded", async () => {
    const { child } = await setup();

    expect(child.canExport).toBe(true);
  });

  it.each([
    { case: "the usage history loads", input: { usageHistory: undefined } },
    { case: "the usage stats load", input: { usageStats: undefined } },
    { case: "the usage history fails to load", input: { isHistoryError: true } },
    { case: "the usage stats fail to load", input: { isStatsError: true } }
  ])("holds the export back while $case", async ({ input }) => {
    const { child } = await setup(input);

    expect(child.canExport).toBe(false);
  });

  it("falls back to empty usage while it loads", async () => {
    const { child } = await setup({ usageHistory: undefined, usageStats: undefined, isLoading: true });

    expect(child.usageHistoryData).toEqual([]);
    expect(child.usageHistoryStatsData).toEqual({ totalSpent: 0, averageSpentPerDay: 0, totalDeployments: 0, averageDeploymentsPerDay: 0 });
    expect(child.isUsageHistoryLoading).toBe(true);
    expect(child.isUsageHistoryStatsLoading).toBe(true);
  });

  it("passes through error flags", async () => {
    const { child } = await setup({ isHistoryError: true, isStatsError: true });

    expect(child.isUsageHistoryError).toBe(true);
    expect(child.isUsageHistoryStatsError).toBe(true);
  });

  it("passes the current spend rate through", async () => {
    const { child } = await setup({ spendRate: { perHourUsd: 1.5, isLoading: false, isError: true } });

    expect(child.spendRate).toEqual({ perHourUsd: 1.5, isLoading: false, isError: true });
  });

  it("reloads every section for a chosen preset", async () => {
    const { child, childCapturer, useUsage, useUsageStats } = await setup();
    const last7Days = getUsagePresetRange("last7Days");

    act(() => child.onDatePresetChange("last7Days"));
    const updated = await childCapturer.awaitChild(next => next.datePreset === "last7Days");

    expect(updated.dateRange).toEqual(last7Days);
    expect(useUsage).toHaveBeenLastCalledWith({ address: "akash1abc", startDate: last7Days.from, endDate: last7Days.to });
    expect(useUsageStats).toHaveBeenCalledWith({ address: "akash1abc", startDate: last7Days.from, endDate: last7Days.to });
  });

  it("starts a custom range from the range on screen", async () => {
    const { child, childCapturer } = await setup();
    act(() => child.onDatePresetChange("last7Days"));
    const showingLast7Days = await childCapturer.awaitChild(next => next.datePreset === "last7Days");

    act(() => showingLast7Days.onDatePresetChange("custom"));
    const updated = await childCapturer.awaitChild(next => next.datePreset === "custom");

    expect(updated.dateRange).toEqual(getUsagePresetRange("last7Days"));
  });

  it("switches to a custom range spanning whole days when dates are picked", async () => {
    const { child, childCapturer, useUsage } = await setup();

    act(() => child.onDateRangeChange({ from: new Date(2026, 5, 1, 10), to: new Date(2026, 5, 20, 9) }));
    const updated = await childCapturer.awaitChild(next => next.datePreset === "custom");

    expect(updated.dateRange).toEqual({ from: startOfDay(new Date(2026, 5, 1)), to: endOfDay(new Date(2026, 5, 20)) });
    expect(useUsage).toHaveBeenLastCalledWith({ address: "akash1abc", startDate: updated.dateRange.from, endDate: updated.dateRange.to });
  });

  it.each(["owner", "admin", "billing"] satisfies OrganizationRole[])("shows a team's %s the spend by project over the range on screen", async role => {
    const { child, childCapturer } = await setup({ organization: { type: "team", role }, projectsEnabled: true });
    const last30Days = getUsagePresetRange("last30Days");

    expect(child.projectSpendRange).toEqual({ startDate: format(last30Days.from, "yyyy-MM-dd"), endDate: format(last30Days.to, "yyyy-MM-dd") });

    act(() => child.onDateRangeChange({ from: new Date(2026, 5, 1), to: new Date(2026, 5, 20) }));
    const updated = await childCapturer.awaitChild(next => next.datePreset === "custom");

    expect(updated.projectSpendRange).toEqual({ startDate: "2026-06-01", endDate: "2026-06-20" });
  });

  it.each(["member", "viewer"] satisfies OrganizationRole[])("keeps the spend by project from a team's %s", async role => {
    const { child } = await setup({ organization: { type: "team", role }, projectsEnabled: true });

    expect(child.projectSpendRange).toBeNull();
  });

  it("shows no spend by project in a personal account", async () => {
    const { child } = await setup({ organization: { type: "personal", role: "owner" }, projectsEnabled: false });

    expect(child.projectSpendRange).toBeNull();
  });

  it("shows no spend by project while organizations are off", async () => {
    const { child } = await setup({ organization: undefined, projectsEnabled: false });

    expect(child.projectSpendRange).toBeNull();
  });

  it("reads a team's usage from its deployment spend over the range and the previous period", async () => {
    const report = buildDeploymentSpend(0);
    const { child, useDeploymentSpendQuery } = await setup({
      ...TEAM_OWNER,
      deploymentSpend: report,
      previousDeploymentSpend: buildDeploymentSpend(1, 0.5)
    });
    const last30Days = getUsagePresetRange("last30Days");
    const previousPeriod = getPreviousPeriod(last30Days);

    expect(useDeploymentSpendQuery).toHaveBeenCalledWith(spendRangeOf(last30Days), { enabled: true });
    expect(useDeploymentSpendQuery).toHaveBeenCalledWith(spendRangeOf(previousPeriod), { enabled: true });
    expect(child.usageHistoryData).toEqual(scopeUsage(report, null).dailySpend);
    expect(child.usageHistoryStatsData).toEqual(scopeUsage(report, null).stats);
    expect(child.spendChangePercent).not.toBeNull();
  });

  it("offers a team's projects to narrow the page to, starting on every project", async () => {
    const { child } = await setup({ ...TEAM_OWNER, projects: [mock<Project>({ id: "storefront", name: "Storefront" })] });

    expect(child.projectScope?.projects).toEqual([{ id: "storefront", name: "Storefront" }]);
    expect(child.projectScope?.selected).toBeNull();
  });

  it("narrows the figures and the spend rate to the picked project and drops the spend by project", async () => {
    const report = buildDeploymentSpend(0);
    const perBlockUsdByDseq = new Map([
      ["1", 0.01],
      ["2", 0.02]
    ]);
    const { child, childCapturer } = await setup({ ...TEAM_OWNER, deploymentSpend: report, perBlockUsdByDseq });

    act(() => child.projectScope!.onChange("storefront"));
    const narrowed = await childCapturer.awaitChild(next => next.projectScope?.selected === "storefront");

    expect(narrowed.usageHistoryData).toEqual(scopeUsage(report, "storefront").dailySpend);
    expect(narrowed.usageHistoryStatsData.totalDeployments).toBe(1);
    expect(narrowed.spendRate.perHourUsd).toBeCloseTo(perBlockToHourly(0.01), 10);
    expect(narrowed.projectSpendRange).toBeNull();
  });

  it("keeps the whole organization's spend rate on every project", async () => {
    const { child } = await setup({ ...TEAM_OWNER, deploymentSpend: buildDeploymentSpend(0), spendRate: { perHourUsd: 3, isLoading: false, isError: false } });

    expect(child.spendRate.perHourUsd).toBe(3);
  });

  it("holds a project's spend rate back until its deployments are read", async () => {
    const { child, childCapturer } = await setup({ ...TEAM_OWNER, isDeploymentSpendLoading: true });

    act(() => child.projectScope!.onChange("storefront"));
    const narrowed = await childCapturer.awaitChild(next => next.projectScope?.selected === "storefront");

    expect(child.spendRate.isLoading).toBe(false);
    expect(narrowed.spendRate.isLoading).toBe(true);
  });

  it("fails a project's spend rate when its deployments can't be read", async () => {
    const { child, childCapturer } = await setup({ ...TEAM_OWNER, isDeploymentSpendError: true });

    act(() => child.projectScope!.onChange("storefront"));
    const narrowed = await childCapturer.awaitChild(next => next.projectScope?.selected === "storefront");

    expect(child.spendRate.isError).toBe(false);
    expect(narrowed.spendRate.isError).toBe(true);
  });

  it("passes a team's loading and error flags through", async () => {
    const { child } = await setup({ ...TEAM_OWNER, isDeploymentSpendLoading: true, isDeploymentSpendError: true });

    expect(child.usageHistoryData).toEqual([]);
    expect(child.isUsageHistoryLoading).toBe(true);
    expect(child.isUsageHistoryStatsLoading).toBe(true);
    expect(child.isUsageHistoryError).toBe(true);
    expect(child.isUsageHistoryStatsError).toBe(true);
  });

  it("has no spend comparison until a team's previous period loads", async () => {
    const { child } = await setup({ ...TEAM_OWNER, deploymentSpend: buildDeploymentSpend(0) });

    expect(child.spendChangePercent).toBeNull();
  });

  it("offers no project while a team's projects load", async () => {
    const { child } = await setup({ ...TEAM_OWNER, projects: undefined });

    expect(child.projectScope?.projects).toEqual([]);
  });

  it("reads no deployment spend nor projects and offers no project filter outside a team", async () => {
    const { child, useDeploymentSpendQuery, useProjectsQuery } = await setup({ organization: { type: "personal", role: "owner" }, projectsEnabled: false });

    expect(child.projectScope).toBeNull();
    expect(useDeploymentSpendQuery).toHaveBeenCalledWith(expect.anything(), { enabled: false });
    expect(useProjectsQuery).toHaveBeenCalledWith({ enabled: false });
  });

  it("downloads the usage on screen as a CSV", async () => {
    const { child, usageHistory, usageStats } = await setup();
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:usage");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    onTestFinished(() => [createObjectURL, revokeObjectURL, click].forEach(spy => spy.mockRestore()));

    child.onExport();

    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("text/csv;charset=utf-8;");
    expect(await blob.text()).toBe(buildUsageCsv(usageHistory!, usageStats!));
    expect(click.mock.contexts[0]).toHaveAttribute("download", "akash_billing_usage.csv");
  });

  async function setup(
    input: {
      usageHistory?: UsageHistory;
      usageStats?: UsageHistoryStats;
      previousStats?: UsageHistoryStats;
      isLoading?: boolean;
      isHistoryError?: boolean;
      isStatsError?: boolean;
      spendRate?: { perHourUsd: number; isLoading: boolean; isError: boolean };
      organization?: Pick<OrganizationOutput, "type" | "role">;
      projectsEnabled?: boolean;
      deploymentSpend?: DeploymentSpendReport;
      previousDeploymentSpend?: DeploymentSpendReport;
      isDeploymentSpendLoading?: boolean;
      isDeploymentSpendError?: boolean;
      projects?: Project[];
      perBlockUsdByDseq?: Map<string, number>;
    } = {}
  ) {
    const usageHistory = "usageHistory" in input ? input.usageHistory : buildUsageHistory();
    const usageStats = "usageStats" in input ? input.usageStats : buildUsageHistoryStats();
    const previousStats = "previousStats" in input ? input.previousStats : buildUsageHistoryStats();

    const useWallet: typeof DEPENDENCIES.useWallet = () => Object.assign(mock<ReturnType<typeof DEPENDENCIES.useWallet>>(), { address: "akash1abc" });

    const historyQuery = Object.assign(mock<ReturnType<typeof DEPENDENCIES.useUsage>>(), {
      data: usageHistory,
      isLoading: input.isLoading ?? false,
      isError: input.isHistoryError ?? false
    });
    const useUsage = vi.fn<typeof DEPENDENCIES.useUsage>(() => historyQuery);

    const statsQuery = Object.assign(mock<ReturnType<typeof DEPENDENCIES.useUsageStats>>(), {
      data: usageStats,
      isLoading: input.isLoading ?? false,
      isError: input.isStatsError ?? false
    });
    const previousStatsQuery = Object.assign(mock<ReturnType<typeof DEPENDENCIES.useUsageStats>>(), { data: previousStats });
    const useUsageStats = vi.fn<typeof DEPENDENCIES.useUsageStats>(params =>
      params.endDate && params.endDate < startOfToday() ? previousStatsQuery : statsQuery
    );

    const spendRate = Object.assign(
      mock<ReturnType<typeof DEPENDENCIES.useCurrentSpendRate>>(),
      { perBlockUsdByDseq: input.perBlockUsdByDseq ?? new Map() },
      input.spendRate ?? { perHourUsd: 0, isLoading: false, isError: false }
    );
    const useCurrentSpendRate: typeof DEPENDENCIES.useCurrentSpendRate = () => spendRate;

    const activeOrganization = input.organization && mock<OrganizationOutput>(input.organization);
    const useActiveOrganization: typeof DEPENDENCIES.useActiveOrganization = () =>
      mock<ReturnType<typeof DEPENDENCIES.useActiveOrganization>>({ activeOrganization, projectsEnabled: input.projectsEnabled ?? false });

    const today = format(startOfToday(), "yyyy-MM-dd");
    const deploymentSpendQuery = (data: DeploymentSpendReport | undefined) =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useDeploymentSpendQuery>>(), {
        data,
        isLoading: input.isDeploymentSpendLoading ?? false,
        isError: input.isDeploymentSpendError ?? false
      });
    const useDeploymentSpendQuery = vi.fn<typeof DEPENDENCIES.useDeploymentSpendQuery>(range =>
      deploymentSpendQuery(range.endDate < today ? input.previousDeploymentSpend : input.deploymentSpend)
    );
    const useProjectsQuery = vi.fn<typeof DEPENDENCIES.useProjectsQuery>(() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useProjectsQuery>>(), { data: input.projects })
    );

    const childCapturer = createContainerTestingChildCapturer<ChildrenProps>();

    render(
      <UsageContainer
        dependencies={{ useWallet, useUsage, useUsageStats, useCurrentSpendRate, useActiveOrganization, useDeploymentSpendQuery, useProjectsQuery }}
      >
        {props => childCapturer.renderChild(props)}
      </UsageContainer>
    );

    const child = await childCapturer.awaitChild();

    return { child, childCapturer, useUsage, useUsageStats, useDeploymentSpendQuery, useProjectsQuery, usageHistory, usageStats };
  }
});

const TEAM_OWNER = { organization: { type: "team", role: "owner" }, projectsEnabled: true } as const;

function spendRangeOf(range: { from: Date; to: Date }) {
  return { startDate: format(range.from, "yyyy-MM-dd"), endDate: format(range.to, "yyyy-MM-dd") };
}

function buildDeploymentSpend(periodsAgo: number, scale = 1): DeploymentSpendReport {
  const range = getUsagePresetRange("last30Days");
  const { from, to } = periodsAgo ? getPreviousPeriod(range) : range;
  const day = format(subDays(startOfToday(), 30 * periodsAgo + 2), "yyyy-MM-dd");

  return {
    ...spendRangeOf({ from, to }),
    projects: [],
    days: [
      { date: day, projectId: "storefront", consumedUsd: 4 * scale },
      { date: day, projectId: "marketing", consumedUsd: 6 * scale }
    ],
    deployments: [
      { dseq: "1", name: "web", projectId: "storefront", consumedUsd: 4 * scale, hours: 24 },
      { dseq: "2", name: null, projectId: "marketing", consumedUsd: 6 * scale, hours: 24 }
    ]
  };
}

function buildDay(daysAgo: number, dailyUsdSpent: number) {
  return buildUsageHistoryItem({ date: format(subDays(startOfToday(), daysAgo), "yyyy-MM-dd"), dailyUsdSpent });
}
