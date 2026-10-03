import React from "react";
import { endOfDay, format, startOfDay, startOfToday, subDays } from "date-fns";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UsageHistory, UsageHistoryStats } from "@src/types";
import { buildUsageCsv } from "./buildUsageCsv";
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
      input.spendRate ?? { perHourUsd: 0, isLoading: false, isError: false }
    );
    const useCurrentSpendRate: typeof DEPENDENCIES.useCurrentSpendRate = () => spendRate;

    const childCapturer = createContainerTestingChildCapturer<ChildrenProps>();

    render(
      <UsageContainer dependencies={{ useWallet, useUsage, useUsageStats, useCurrentSpendRate }}>{props => childCapturer.renderChild(props)}</UsageContainer>
    );

    const child = await childCapturer.awaitChild();

    return { child, childCapturer, useUsage, useUsageStats, usageHistory, usageStats };
  }
});

function buildDay(daysAgo: number, dailyUsdSpent: number) {
  return buildUsageHistoryItem({ date: format(subDays(startOfToday(), daysAgo), "yyyy-MM-dd"), dailyUsdSpent });
}
