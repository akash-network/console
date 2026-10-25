import React from "react";
import { endOfDay, startOfDay } from "date-fns";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UsageHistory, UsageHistoryStats } from "@src/types";
import type { DeploymentSpendReport } from "@src/types/deployment-spend";
import type { OrganizationOutput, OrganizationRole } from "@src/types/organization";
import type { Project } from "@src/types/project";
import type { ProjectSpendReport } from "@src/types/project-budget";
import { perBlockToHourly } from "@src/utils/priceUtils";
import { buildProjectUsageCsv, buildUsageCsv } from "./buildUsageCsv";
import { deploymentRowsOf, projectSpendRowsOf, scopeUsage } from "./teamUsage";
import type { ChildrenProps, DEPENDENCIES } from "./UsageContainer";
import { UsageContainer } from "./UsageContainer";
import { getPreviousSpendRange, getUsagePresetRange, toSpendRange } from "./usageDatePresets";

import { act, render } from "@testing-library/react";
import { buildProjectSpend, buildProjectSpendReport, buildSpendAmounts } from "@tests/seeders/projectSpend";
import { buildUsageHistory, buildUsageHistoryItem, buildUsageHistoryStats } from "@tests/seeders/usage";
import { createContainerTestingChildCapturer } from "@tests/unit/container-testing-child-capturer";

describe(UsageContainer.name, () => {
  it("shows the last 30 days by default", async () => {
    const { child, useUsage } = await setup();
    const last30Days = getUsagePresetRange("last30Days");

    expect(child.datePreset).toBe("last30Days");
    expect(child.dateRange).toEqual(last30Days);
    expect(useUsage).toHaveBeenLastCalledWith({ address: "akash1abc", ...toSpendRange(last30Days) });
  });

  it("reads a person's usage over UTC days ending today's, so spend from a west of UTC evening is in range", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-24T03:00:00.000Z"));
    onTestFinished(() => {
      vi.useRealTimers();
    });

    const { useUsage, useUsageStats } = await setup();

    expect(useUsage).toHaveBeenLastCalledWith({ address: "akash1abc", startDate: "2026-09-25", endDate: "2026-10-24" });
    expect(useUsageStats).toHaveBeenCalledWith({ address: "akash1abc", startDate: "2026-09-25", endDate: "2026-10-24" });
    expect(useUsageStats).toHaveBeenCalledWith({ address: "akash1abc", startDate: "2026-08-26", endDate: "2026-09-24" });
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
    const previousPeriod = getPreviousSpendRange(toSpendRange(getUsagePresetRange("last30Days")));

    expect(useUsageStats).toHaveBeenCalledWith({ address: "akash1abc", ...previousPeriod });
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
    expect(useUsage).toHaveBeenLastCalledWith({ address: "akash1abc", ...toSpendRange(last7Days) });
    expect(useUsageStats).toHaveBeenCalledWith({ address: "akash1abc", ...toSpendRange(last7Days) });
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
    expect(useUsage).toHaveBeenLastCalledWith({ address: "akash1abc", startDate: "2026-06-01", endDate: "2026-06-20" });
  });

  it.each(["owner", "admin", "billing"] satisfies OrganizationRole[])("shows a team's %s the spend by project over the range on screen", async role => {
    const { child, childCapturer, useProjectSpendQuery } = await setup({ organization: { type: "team", role }, projectsEnabled: true });
    const last30Days = getUsagePresetRange("last30Days");

    expect(child.projectSpend).not.toBeNull();
    expect(useProjectSpendQuery).toHaveBeenLastCalledWith(toSpendRange(last30Days), { enabled: true });

    act(() => child.onDateRangeChange({ from: new Date(2026, 5, 1), to: new Date(2026, 5, 20) }));
    await childCapturer.awaitChild(next => next.datePreset === "custom");

    expect(useProjectSpendQuery).toHaveBeenLastCalledWith({ startDate: "2026-06-01", endDate: "2026-06-20" }, { enabled: true });
  });

  it.each(["member", "viewer"] satisfies OrganizationRole[])("keeps the spend by project from a team's %s", async role => {
    const { child, useProjectSpendQuery } = await setup({ organization: { type: "team", role }, projectsEnabled: true });

    expect(child.projectSpend).toBeNull();
    expect(useProjectSpendQuery).toHaveBeenCalledWith(expect.anything(), { enabled: false });
  });

  it("shows no spend by project in a personal account", async () => {
    const { child } = await setup({ organization: { type: "personal", role: "owner" }, projectsEnabled: false });

    expect(child.projectSpend).toBeNull();
  });

  it("shows no spend by project while organizations are off", async () => {
    const { child } = await setup({ organization: undefined, projectsEnabled: false });

    expect(child.projectSpend).toBeNull();
  });

  it("ranks a team's spend by project with each project's deployments and its shade in the daily chart", async () => {
    const deploymentSpend = buildDeploymentSpend(0);
    const projectSpend = buildProjectSpendReport({
      projects: [
        buildProjectSpend({ projectId: "storefront", name: "Storefront", consumedUsd: 4 }),
        buildProjectSpend({ projectId: "marketing", name: "Marketing", consumedUsd: 6 })
      ]
    });
    const { child } = await setup({ ...TEAM_OWNER, deploymentSpend, projectSpend });

    const withoutSelect = (rows: ReturnType<typeof projectSpendRowsOf>) => rows.map(({ onSelect, ...row }) => row);
    expect(withoutSelect(child.projectSpend!.rows)).toEqual(withoutSelect(projectSpendRowsOf(projectSpend, deploymentSpend, vi.fn())));
    expect(child.projectSpend).toEqual(expect.objectContaining({ isEstimated: false, isPartial: false, isLoading: false, isError: false }));
  });

  it("narrows the page to the project picked from the spend by project", async () => {
    const projectSpend = buildProjectSpendReport({ projects: [buildProjectSpend({ projectId: "marketing", consumedUsd: 6 })] });
    const { child, childCapturer } = await setup({ ...TEAM_OWNER, deploymentSpend: buildDeploymentSpend(0), projectSpend });

    act(() => child.projectSpend!.rows[0].onSelect!());
    const narrowed = await childCapturer.awaitChild(next => next.projectScope?.selected === "marketing");

    expect(narrowed.projectSpend).toBeNull();
  });

  it("flags an estimated spend by project and one limited to the projects the caller can open", async () => {
    const { child } = await setup({ ...TEAM_OWNER, projectSpend: buildProjectSpendReport({ isEstimated: true, total: null }) });

    expect(child.projectSpend).toEqual(expect.objectContaining({ isEstimated: true, isPartial: true }));
  });

  it("flags nothing while the spend by project loads", async () => {
    const { child } = await setup({ ...TEAM_OWNER, projectSpend: undefined, isProjectSpendLoading: true });

    expect(child.projectSpend).toEqual({ rows: [], isEstimated: false, isPartial: false, isLoading: true, isError: false });
  });

  it("holds the spend by project back until the deployments are read", async () => {
    const { child } = await setup({ ...TEAM_OWNER, projectSpend: buildProjectSpendReport(), isDeploymentSpendLoading: true });

    expect(child.projectSpend?.isLoading).toBe(true);
  });

  it("passes a failed load of the spend by project through", async () => {
    const { child } = await setup({ ...TEAM_OWNER, isProjectSpendError: true });

    expect(child.projectSpend?.isError).toBe(true);
  });

  it("fails the spend by project when the deployments behind its counts can't be read", async () => {
    const { child } = await setup({ ...TEAM_OWNER, projectSpend: buildProjectSpendReport(), isDeploymentSpendError: true });

    expect(child.projectSpend?.isError).toBe(true);
  });

  it("reads a team's usage from its deployment spend over the range and the previous period", async () => {
    const report = buildDeploymentSpend(0);
    const { child, useDeploymentSpendQuery } = await setup({
      ...TEAM_OWNER,
      deploymentSpend: report,
      previousDeploymentSpend: buildDeploymentSpend(1, 0.5)
    });
    const last30Days = toSpendRange(getUsagePresetRange("last30Days"));

    expect(useDeploymentSpendQuery).toHaveBeenCalledWith(last30Days, { enabled: true });
    expect(useDeploymentSpendQuery).toHaveBeenCalledWith(getPreviousSpendRange(last30Days), { enabled: true });
    expect(child.usageHistoryData).toEqual(scopeUsage(report, null).dailySpend);
    expect(child.usageHistoryStatsData).toEqual(scopeUsage(report, null).stats);
    expect(child.spendChangePercent).not.toBeNull();
  });

  it("reads a team's spend over UTC days ending today's, so spend from a west of UTC evening is in range", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-24T03:00:00.000Z"));
    onTestFinished(() => {
      vi.useRealTimers();
    });

    const { useDeploymentSpendQuery, useProjectSpendQuery } = await setup(TEAM_OWNER);

    expect(useProjectSpendQuery).toHaveBeenLastCalledWith({ startDate: "2026-09-25", endDate: "2026-10-24" }, { enabled: true });
    expect(useDeploymentSpendQuery).toHaveBeenCalledWith({ startDate: "2026-09-25", endDate: "2026-10-24" }, { enabled: true });
    expect(useDeploymentSpendQuery).toHaveBeenCalledWith({ startDate: "2026-08-26", endDate: "2026-09-24" }, { enabled: true });
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
    expect(narrowed.projectSpend).toBeNull();
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

  it("splits a team's daily spend by project across every project", async () => {
    const report = { ...buildDeploymentSpend(0), projects: [buildReportProject("storefront", "Storefront"), buildReportProject("marketing", "Marketing")] };
    const { child } = await setup({ ...TEAM_OWNER, deploymentSpend: report });

    expect(child.dailySpendBreakdown?.caption).toBe("Each bar is one day's total, split by project");
    expect(child.dailySpendBreakdown?.series.map(({ label }) => label)).toEqual(["Marketing", "Storefront"]);
  });

  it("narrows the page to the project picked from the daily spend", async () => {
    const report = { ...buildDeploymentSpend(0), projects: [buildReportProject("marketing", "Marketing")] };
    const { child, childCapturer } = await setup({ ...TEAM_OWNER, deploymentSpend: report });

    act(() => child.dailySpendBreakdown!.series[0].onSelect!());
    const narrowed = await childCapturer.awaitChild(next => next.projectScope?.selected === "marketing");

    expect(narrowed.usageHistoryData).toEqual(scopeUsage(report, "marketing").dailySpend);
  });

  it("splits nothing while a team's deployment spend loads", async () => {
    const { child } = await setup({ ...TEAM_OWNER, isDeploymentSpendLoading: true });

    expect(child.dailySpendBreakdown?.series).toEqual([]);
  });

  it("charts the picked project alone and names it", async () => {
    const { child, childCapturer } = await setup({
      ...TEAM_OWNER,
      deploymentSpend: buildDeploymentSpend(0),
      projects: [mock<Project>({ id: "marketing", name: "Marketing" }), mock<Project>({ id: "storefront", name: "Storefront" })]
    });

    act(() => child.projectScope!.onChange("storefront"));
    const narrowed = await childCapturer.awaitChild(next => next.projectScope?.selected === "storefront");

    expect(narrowed.dailySpendBreakdown).toEqual({ caption: "Each bar is one day's total for Storefront", series: [] });
  });

  it("names no project in the daily spend until the team's projects load", async () => {
    const { child, childCapturer } = await setup({ ...TEAM_OWNER, deploymentSpend: buildDeploymentSpend(0), projects: undefined });

    act(() => child.projectScope!.onChange("storefront"));
    const narrowed = await childCapturer.awaitChild(next => next.projectScope?.selected === "storefront");

    expect(narrowed.dailySpendBreakdown?.caption).toBe("Each bar is one day's total for this project");
  });

  it("breaks a team's spend down by deployment across every project", async () => {
    const report = { ...buildDeploymentSpend(0), projects: [buildReportProject("storefront", "Storefront"), buildReportProject("marketing", "Marketing")] };
    const { child } = await setup({ ...TEAM_OWNER, deploymentSpend: report });

    expect(child.deploymentSpend).toEqual({
      title: "Spend by deployment",
      rows: deploymentRowsOf(report, null),
      showsProject: true,
      isLoading: false,
      isError: false
    });
  });

  it("breaks the picked project's spend down by deployment without repeating the project", async () => {
    const report = buildDeploymentSpend(0);
    const { child, childCapturer } = await setup({
      ...TEAM_OWNER,
      deploymentSpend: report,
      projects: [mock<Project>({ id: "storefront", name: "Storefront" })]
    });

    act(() => child.projectScope!.onChange("storefront"));
    const narrowed = await childCapturer.awaitChild(next => next.projectScope?.selected === "storefront");

    expect(narrowed.deploymentSpend).toEqual(
      expect.objectContaining({ title: "Spend by deployment · Storefront", rows: deploymentRowsOf(report, "storefront"), showsProject: false })
    );
  });

  it("passes the loading and error flags of a team's deployment spend through", async () => {
    const { child } = await setup({ ...TEAM_OWNER, isDeploymentSpendLoading: true, isDeploymentSpendError: true });

    expect(child.deploymentSpend).toEqual(expect.objectContaining({ rows: [], isLoading: true, isError: true }));
  });

  it("reads no deployment spend nor projects and offers no project filter outside a team", async () => {
    const { child, useDeploymentSpendQuery, useProjectsQuery } = await setup({ organization: { type: "personal", role: "owner" }, projectsEnabled: false });

    expect(child.projectScope).toBeNull();
    expect(child.dailySpendBreakdown).toBeNull();
    expect(child.deploymentSpend).toBeNull();
    expect(useDeploymentSpendQuery).toHaveBeenCalledWith(expect.anything(), { enabled: false });
    expect(useProjectsQuery).toHaveBeenCalledWith({ enabled: false });
  });

  it("downloads the usage on screen as a CSV", async () => {
    const { child, usageHistory, usageStats } = await setup();
    const downloads = spyOnDownloads();

    child.onExport();

    expect(await downloads.last()).toEqual({
      type: "text/csv;charset=utf-8;",
      content: buildUsageCsv(usageHistory!, usageStats!),
      filename: "akash_billing_usage.csv"
    });
  });

  it("downloads nothing while the export is held back", async () => {
    const { child } = await setup({ usageHistory: undefined });
    const downloads = spyOnDownloads();

    child.onExport();

    expect(downloads.count()).toBe(0);
  });

  it("keeps downloading the wallet's usage for a team shown across every project", async () => {
    const { child, usageHistory, usageStats } = await setup({ ...TEAM_OWNER, deploymentSpend: buildDeploymentSpend(0) });
    const downloads = spyOnDownloads();

    child.onExport();

    expect(await downloads.last()).toEqual(
      expect.objectContaining({ content: buildUsageCsv(usageHistory!, usageStats!), filename: "akash_billing_usage.csv" })
    );
  });

  it("downloads the picked project's daily spend over the range on screen in a file named after it", async () => {
    const report = buildDeploymentSpend(0);
    const { child, childCapturer } = await setup({
      ...TEAM_OWNER,
      deploymentSpend: report,
      projects: [mock<Project>({ id: "storefront", name: "Checkout API", slug: "storefront" })]
    });
    const downloads = spyOnDownloads();

    act(() => child.projectScope!.onChange("storefront"));
    const narrowed = await childCapturer.awaitChild(next => next.projectScope?.selected === "storefront");
    narrowed.onExport();

    const { dailySpend, stats } = scopeUsage(report, "storefront");
    expect(narrowed.canExport).toBe(true);
    expect(await downloads.last()).toEqual({
      type: "text/csv;charset=utf-8;",
      content: buildProjectUsageCsv(dailySpend, stats),
      filename: "akash_billing_usage_checkout-api.csv"
    });
  });

  it("names the file after the project's slug when its name has no latin letter or digit", async () => {
    const { child, childCapturer } = await setup({
      ...TEAM_OWNER,
      deploymentSpend: buildDeploymentSpend(0),
      projects: [mock<Project>({ id: "storefront", name: "店舗", slug: "project-1a2b3c4d" })]
    });
    const downloads = spyOnDownloads();

    act(() => child.projectScope!.onChange("storefront"));
    const narrowed = await childCapturer.awaitChild(next => next.projectScope?.selected === "storefront");
    narrowed.onExport();

    expect(await downloads.last()).toEqual(expect.objectContaining({ filename: "akash_billing_usage_project-1a2b3c4d.csv" }));
  });

  it.each([
    { case: "its deployment spend loads", input: { isDeploymentSpendLoading: true } },
    { case: "its deployment spend fails to load", input: { deploymentSpend: buildDeploymentSpend(0), isDeploymentSpendError: true } },
    { case: "the team's projects load", input: { deploymentSpend: buildDeploymentSpend(0), projects: undefined } }
  ])("holds the picked project's export back while $case", async ({ input }) => {
    const { child, childCapturer } = await setup({ ...TEAM_OWNER, projects: [mock<Project>({ id: "storefront", name: "Storefront" })], ...input });

    act(() => child.projectScope!.onChange("storefront"));
    const narrowed = await childCapturer.awaitChild(next => next.projectScope?.selected === "storefront");

    expect(narrowed.canExport).toBe(false);
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
      projectSpend?: ProjectSpendReport;
      isProjectSpendLoading?: boolean;
      isProjectSpendError?: boolean;
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
    const utcToday = new Date().toISOString().slice(0, 10);
    const useUsageStats = vi.fn<typeof DEPENDENCIES.useUsageStats>(params => (params.endDate && params.endDate < utcToday ? previousStatsQuery : statsQuery));

    const spendRate = Object.assign(
      mock<ReturnType<typeof DEPENDENCIES.useCurrentSpendRate>>(),
      { perBlockUsdByDseq: input.perBlockUsdByDseq ?? new Map() },
      input.spendRate ?? { perHourUsd: 0, isLoading: false, isError: false }
    );
    const useCurrentSpendRate: typeof DEPENDENCIES.useCurrentSpendRate = () => spendRate;

    const activeOrganization = input.organization && mock<OrganizationOutput>(input.organization);
    const useActiveOrganization: typeof DEPENDENCIES.useActiveOrganization = () =>
      mock<ReturnType<typeof DEPENDENCIES.useActiveOrganization>>({ activeOrganization, projectsEnabled: input.projectsEnabled ?? false });

    const deploymentSpendQuery = (data: DeploymentSpendReport | undefined) =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useDeploymentSpendQuery>>(), {
        data,
        isLoading: input.isDeploymentSpendLoading ?? false,
        isError: input.isDeploymentSpendError ?? false
      });
    const useDeploymentSpendQuery = vi.fn<typeof DEPENDENCIES.useDeploymentSpendQuery>(range =>
      deploymentSpendQuery(range.endDate < utcToday ? input.previousDeploymentSpend : input.deploymentSpend)
    );
    const projectSpend = "projectSpend" in input ? input.projectSpend : buildProjectSpendReport({ unassigned: buildSpendAmounts() });
    const useProjectSpendQuery = vi.fn<typeof DEPENDENCIES.useProjectSpendQuery>(() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useProjectSpendQuery>>(), {
        data: projectSpend,
        isLoading: input.isProjectSpendLoading ?? false,
        isError: input.isProjectSpendError ?? false
      })
    );
    const useProjectsQuery = vi.fn<typeof DEPENDENCIES.useProjectsQuery>(() =>
      Object.assign(mock<ReturnType<typeof DEPENDENCIES.useProjectsQuery>>(), { data: input.projects })
    );

    const childCapturer = createContainerTestingChildCapturer<ChildrenProps>();

    render(
      <UsageContainer
        dependencies={{
          useWallet,
          useUsage,
          useUsageStats,
          useCurrentSpendRate,
          useActiveOrganization,
          useDeploymentSpendQuery,
          useProjectSpendQuery,
          useProjectsQuery
        }}
      >
        {props => childCapturer.renderChild(props)}
      </UsageContainer>
    );

    const child = await childCapturer.awaitChild();

    return { child, childCapturer, useUsage, useUsageStats, useDeploymentSpendQuery, useProjectSpendQuery, useProjectsQuery, usageHistory, usageStats };
  }
});

const TEAM_OWNER = { organization: { type: "team", role: "owner" }, projectsEnabled: true } as const;

function buildDeploymentSpend(periodsAgo: number, scale = 1): DeploymentSpendReport {
  const range = toSpendRange(getUsagePresetRange("last30Days"));
  const day = utcDateDaysAgo(30 * periodsAgo + 2);

  return {
    ...(periodsAgo ? getPreviousSpendRange(range) : range),
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

function spyOnDownloads() {
  const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:usage");
  const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  onTestFinished(() => [createObjectURL, revokeObjectURL, click].forEach(spy => spy.mockRestore()));

  return {
    count: () => createObjectURL.mock.calls.length,
    last: async () => {
      const blob = createObjectURL.mock.calls.at(-1)![0] as Blob;
      return { type: blob.type, content: await blob.text(), filename: (click.mock.contexts.at(-1) as HTMLAnchorElement).getAttribute("download") };
    }
  };
}

function buildReportProject(projectId: string, name: string): DeploymentSpendReport["projects"][number] {
  return { projectId, name, isDefault: false, isDeleted: false };
}

function buildDay(daysAgo: number, dailyUsdSpent: number) {
  return buildUsageHistoryItem({ date: utcDateDaysAgo(daysAgo), dailyUsdSpent });
}

function utcDateDaysAgo(daysAgo: number) {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
