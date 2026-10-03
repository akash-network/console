import React from "react";
import { IntlProvider } from "react-intl";
import { getDaysInMonth } from "date-fns";
import { describe, expect, it, vi } from "vitest";

import type { ChildrenProps } from "@src/components/billing-usage/UsageContainer/UsageContainer";
import { getUsagePresetRange, type UsageDatePreset, type UsageDateRange } from "@src/components/billing-usage/UsageContainer/usageDatePresets";
import type { UsageHistory, UsageHistoryStats } from "@src/types";
import { DEPENDENCIES, UsageView } from "./UsageView";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildUsageHistory, buildUsageHistoryStats } from "@tests/seeders/usage";
import { MockComponents } from "@tests/unit/mocks";

describe(UsageView.name, () => {
  it("shows total spend with its rise against the previous period", () => {
    setup({ stats: { totalSpent: 1234.5 }, spendChangePercent: 25 });

    const tile = screen.getByRole("group", { name: "Total spend" });
    expect(within(tile).getByText("$1,234.50")).toBeInTheDocument();
    expect(within(tile).getByText("Last 30 days · +25% vs prior")).toBeInTheDocument();
  });

  it("shows a drop against the previous period", () => {
    setup({ spendChangePercent: -20 });

    expect(within(screen.getByRole("group", { name: "Total spend" })).getByText("Last 30 days · -20% vs prior")).toBeInTheDocument();
  });

  it("calls a change under half a percent the same as prior", () => {
    setup({ spendChangePercent: 0.4 });

    expect(within(screen.getByRole("group", { name: "Total spend" })).getByText("Last 30 days · same as prior")).toBeInTheDocument();
  });

  it("rounds a change just over half a percent to one percent", () => {
    setup({ spendChangePercent: -0.6 });

    expect(within(screen.getByRole("group", { name: "Total spend" })).getByText("Last 30 days · -1% vs prior")).toBeInTheDocument();
  });

  it("leaves the comparison out when there is nothing to compare against", () => {
    setup({ spendChangePercent: null });

    expect(within(screen.getByRole("group", { name: "Total spend" })).getByText("Last 30 days")).toBeInTheDocument();
  });

  it("names a custom range by its dates", () => {
    setup({ datePreset: "custom", dateRange: { from: new Date(2026, 5, 1), to: new Date(2026, 5, 20, 23, 59) } });

    expect(within(screen.getByRole("group", { name: "Total spend" })).getByText("Jun 1 to Jun 20")).toBeInTheDocument();
  });

  it("names the years of a custom range that spans two years", () => {
    setup({ datePreset: "custom", dateRange: { from: new Date(2025, 11, 1), to: new Date(2026, 0, 15, 23, 59) } });

    expect(within(screen.getByRole("group", { name: "Total spend" })).getByText("Dec 1, 2025 to Jan 15, 2026")).toBeInTheDocument();
  });

  it("shows the daily average across the days of the range", () => {
    setup({ stats: { averageSpentPerDay: 41.15 } });

    const tile = screen.getByRole("group", { name: "Daily average" });
    expect(within(tile).getByText("$41.15")).toBeInTheDocument();
    expect(within(tile).getByText("Across 30 days")).toBeInTheDocument();
  });

  it("counts a single-day range as one day", () => {
    const today = getUsagePresetRange("last7Days").to;
    setup({ datePreset: "custom", dateRange: { from: new Date(today.getFullYear(), today.getMonth(), today.getDate()), to: today } });

    expect(within(screen.getByRole("group", { name: "Daily average" })).getByText("Across 1 day")).toBeInTheDocument();
  });

  it("shows the deployments active during the range", () => {
    setup({ stats: { totalDeployments: 1234, averageDeploymentsPerDay: 0.25 } });

    const tile = screen.getByRole("group", { name: "Deployments" });
    expect(within(tile).getByText("1,234")).toBeInTheDocument();
    expect(within(tile).getByText("0.25 a day on average")).toBeInTheDocument();
  });

  it("projects this month at the current spend rate", () => {
    setup({ spendRate: { perHourUsd: 2, isLoading: false, isError: false } });

    const tile = screen.getByRole("group", { name: "Projected month" });
    expect(
      within(tile).getByText(new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(2 * 24 * getDaysInMonth(new Date())))
    ).toBeInTheDocument();
    expect(within(tile).getByText("At your current $2.00/hr")).toBeInTheDocument();
  });

  it("says nothing is running when there is no spend rate", () => {
    setup({ spendRate: { perHourUsd: 0, isLoading: false, isError: false } });

    const tile = screen.getByRole("group", { name: "Projected month" });
    expect(within(tile).getByText("$0.00")).toBeInTheDocument();
    expect(within(tile).getByText("Nothing is running right now")).toBeInTheDocument();
  });

  it("holds the stats figures back while they load", () => {
    setup({ stats: { totalSpent: 1234.5 }, isUsageHistoryStatsLoading: true });

    for (const name of ["Total spend", "Daily average", "Deployments"]) {
      expect(screen.getByRole("group", { name })).toHaveAttribute("aria-busy", "true");
    }
    expect(screen.queryByText("$1,234.50")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Projected month" })).toHaveAttribute("aria-busy", "false");
  });

  it("shows its own error in each stats tile when the stats fail to load", () => {
    setup({ isUsageHistoryStatsError: true, spendRate: { perHourUsd: 1, isLoading: false, isError: false } });

    for (const name of ["Total spend", "Daily average", "Deployments"]) {
      expect(within(screen.getByRole("group", { name })).getByText("Couldn't be loaded. Refresh the page to try again.")).toBeInTheDocument();
    }
    expect(within(screen.getByRole("group", { name: "Projected month" })).getByText("At your current $1.00/hr")).toBeInTheDocument();
  });

  it("holds the projection back while the spend rate loads", () => {
    setup({ spendRate: { perHourUsd: 0, isLoading: true, isError: false } });

    const tile = screen.getByRole("group", { name: "Projected month" });
    expect(tile).toHaveAttribute("aria-busy", "true");
    expect(within(tile).queryByText("$0.00")).not.toBeInTheDocument();
  });

  it("shows its own error in the projection when the spend rate fails to load", () => {
    setup({ stats: { totalSpent: 50 }, spendRate: { perHourUsd: 0, isLoading: false, isError: true } });

    expect(within(screen.getByRole("group", { name: "Projected month" })).getByText("Couldn't be loaded. Refresh the page to try again.")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Total spend" })).getByText("$50.00")).toBeInTheDocument();
  });

  it("charts the daily usage of the range", () => {
    const history = buildUsageHistory();
    const { DailySpendChart } = setup({ history, isUsageHistoryLoading: true, isUsageHistoryError: true });

    expect(DailySpendChart).toHaveBeenCalledWith(expect.objectContaining({ data: history, isLoading: true, isError: true }), expect.anything());
  });

  it("marks the chart range that matches the selected range", () => {
    setup({ datePreset: "last7Days" });

    expect(screen.getByRole("radio", { name: "Last 7 days" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Last 30 days" })).not.toBeChecked();
  });

  it("marks no chart range for a range the chart toggle doesn't offer", () => {
    setup({ datePreset: "last12Months" });

    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.queryByRole("radio", { checked: true })).not.toBeInTheDocument();
  });

  it("switches the whole page to the range picked on the chart", async () => {
    const { onDatePresetChange } = setup({ datePreset: "last30Days" });

    await userEvent.click(screen.getByRole("radio", { name: "Last 90 days" }));

    expect(onDatePresetChange).toHaveBeenCalledWith("last90Days");
  });

  it("keeps the range when the selected chart range is clicked again", async () => {
    const { onDatePresetChange } = setup({ datePreset: "last30Days" });

    await userEvent.click(screen.getByRole("radio", { name: "Last 30 days" }));

    expect(onDatePresetChange).not.toHaveBeenCalled();
  });

  it("offers the date picker only for a custom range", () => {
    const { DateRangePicker } = setup({ datePreset: "last30Days" });

    expect(DateRangePicker).not.toHaveBeenCalled();
  });

  it("passes the custom range and its limits to the date picker", () => {
    const dateRange = { from: new Date(2026, 6, 1), to: new Date(2026, 6, 31) };
    const { DateRangePicker, onDateRangeChange } = setup({ datePreset: "custom", dateRange });

    const props = DateRangePicker.mock.lastCall![0];
    props.onChange!({ from: new Date(2026, 5, 1), to: new Date(2026, 5, 30) });

    expect(props).toEqual(expect.objectContaining({ date: dateRange, maxRangeInDays: 366 }));
    expect(props.minDate!.getTime()).toBeLessThan(props.maxDate!.getTime());
    expect(onDateRangeChange).toHaveBeenCalledWith({ from: new Date(2026, 5, 1), to: new Date(2026, 5, 30) });
  });

  function setup(
    input: {
      history?: UsageHistory;
      stats?: Partial<UsageHistoryStats>;
      spendChangePercent?: number | null;
      isUsageHistoryLoading?: boolean;
      isUsageHistoryError?: boolean;
      isUsageHistoryStatsLoading?: boolean;
      isUsageHistoryStatsError?: boolean;
      spendRate?: ChildrenProps["spendRate"];
      datePreset?: UsageDatePreset;
      dateRange?: UsageDateRange;
    } = {}
  ) {
    const onDatePresetChange = vi.fn();
    const onDateRangeChange = vi.fn();
    const dependencies = MockComponents(DEPENDENCIES, {
      DailySpendChart: vi.fn(({ rangeToggle }) => <>{rangeToggle}</>)
    });

    render(
      <IntlProvider locale="en-US">
        <UsageView
          usageHistoryData={input.history ?? buildUsageHistory()}
          usageHistoryStatsData={buildUsageHistoryStats(input.stats)}
          spendChangePercent={input.spendChangePercent ?? null}
          isUsageHistoryLoading={input.isUsageHistoryLoading ?? false}
          isUsageHistoryError={input.isUsageHistoryError ?? false}
          isUsageHistoryStatsLoading={input.isUsageHistoryStatsLoading ?? false}
          isUsageHistoryStatsError={input.isUsageHistoryStatsError ?? false}
          spendRate={input.spendRate ?? { perHourUsd: 0, isLoading: false, isError: false }}
          datePreset={input.datePreset ?? "last30Days"}
          onDatePresetChange={onDatePresetChange}
          dateRange={input.dateRange ?? getUsagePresetRange(input.datePreset && input.datePreset !== "custom" ? input.datePreset : "last30Days")}
          onDateRangeChange={onDateRangeChange}
          dependencies={dependencies}
        />
      </IntlProvider>
    );

    return { ...dependencies, onDatePresetChange, onDateRangeChange };
  }
});
