import "@testing-library/jest-dom";

import React from "react";
import type { LinearProgressProps } from "@mui/material";

import type { CumulativeSpendingLineChartProps } from "@src/components/billing-usage/CumulativeSpendingLineChart/CumulativeSpendingLineChart";
import type { DailyUsageBarChartProps } from "@src/components/billing-usage/DailyUsageBarChart/DailyUsageBarChart";
import { COMPONENTS, UsageView, type UsageViewProps } from "@src/components/billing-usage/UsageView/UsageView";

import { fireEvent, render, screen } from "@testing-library/react";
import { buildUsageHistory, buildUsageHistoryStats } from "@tests/seeders/usage";
import { MockComponents } from "@tests/unit/mocks";

describe(UsageView.name, () => {
  it("renders an error message when stats fail to load", () => {
    setup({ isUsageHistoryStatsError: true });
    expect(screen.queryByText("Error loading usage stats")).toBeInTheDocument();
  });

  it("renders two progress bars while stats are fetching", () => {
    setup({ isFetchingUsageHistoryStats: true });
    const bars = screen.getAllByRole("progressbar");
    expect(bars).toHaveLength(2);
  });

  it("displays usage stats data when available", () => {
    const { usageHistoryStatsData } = setup({
      usageHistoryStatsData: {
        totalSpent: 100,
        averageSpentPerDay: 7,
        totalDeployments: 3,
        averageDeploymentsPerDay: 0.5
      }
    });
    expect(screen.getByText(usageHistoryStatsData.totalSpent)).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => {
        return element?.textContent === "7 average per day";
      })
    ).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();

    expect(
      screen.getByText((_, element) => {
        return element?.textContent === "0.5 average per day";
      })
    ).toBeInTheDocument();
  });

  it("renders an error message when history data fails to load", () => {
    setup({ isUsageHistoryError: true });
    expect(screen.getByText("Error loading usage data")).toBeInTheDocument();
  });

  it("renders charts with correct data and loading state", () => {
    const { usageHistoryData } = setup({ isFetchingUsageHistory: true });

    const daily = screen.getByTestId("daily-chart");
    expect(daily).toHaveAttribute("data-fetching", "true");
    expect(daily).toHaveTextContent(JSON.stringify(usageHistoryData));

    const cumulative = screen.getByTestId("cumulative-chart");
    expect(cumulative).toHaveAttribute("data-fetching", "true");
  });

  it("renders charts in non-loading state by default", () => {
    setup();
    expect(screen.getByTestId("daily-chart")).toHaveAttribute("data-fetching", "false");
    expect(screen.getByTestId("cumulative-chart")).toHaveAttribute("data-fetching", "false");
  });

  it("calls onDateRangeChange when date range start changes", () => {
    const onDateRangeChange = jest.fn();
    setup({
      onDateRangeChange,
      dateRange: {
        from: new Date(),
        to: new Date("2030-01-01")
      }
    });
    fireEvent.change(screen.getByLabelText("Filter by start date"), {
      target: { value: "2025-01-01" }
    });
    expect(onDateRangeChange).toHaveBeenCalledWith({
      from: new Date("2025-01-01"),
      to: new Date("2030-01-01")
    });
  });

  it("calls onDateRangeChange when date range end changes", () => {
    const onDateRangeChange = jest.fn();
    setup({
      onDateRangeChange,
      dateRange: {
        from: new Date("2020-01-01")
      }
    });
    fireEvent.change(screen.getByLabelText("Filter by end date"), {
      target: { value: "2025-01-01" }
    });
    expect(onDateRangeChange).toHaveBeenCalledWith({
      from: new Date("2020-01-01"),
      to: new Date("2025-01-01")
    });
  });

  function setup(props: Partial<UsageViewProps> = {}) {
    const defaultComponents: NonNullable<UsageViewProps["components"]> = {
      FormattedNumber: ({ value }: { value: number }) => <span>{value}</span>,
      Title: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
      DailyUsageBarChart: ({ data, isFetching }: DailyUsageBarChartProps) => (
        <div data-testid="daily-chart" data-fetching={String(isFetching)}>
          {JSON.stringify(data)}
        </div>
      ),
      CumulativeSpendingLineChart: ({ data, isFetching }: CumulativeSpendingLineChartProps) => (
        <div data-testid="cumulative-chart" data-fetching={String(isFetching)}>
          {JSON.stringify(data)}
        </div>
      ),
      LinearProgress: (props: Omit<LinearProgressProps, "ref">) => <div role="progressbar" {...props} />,
      DateRangePicker: ({ date = props.dateRange, onChange }) => (
        <div>
          <label>
            <span>Filter by start date</span>
            <input
              type="date"
              value={date?.from ? date.from.toISOString().split("T")[0] : ""}
              onChange={e => onChange?.({ from: new Date(e.target.value), to: date?.to })}
            />
          </label>
          <label>
            <span>Filter by end date</span>
            <input
              type="date"
              value={date?.to ? date.to.toISOString().split("T")[0] : ""}
              onChange={e => onChange?.({ from: date?.from, to: new Date(e.target.value) })}
            />
          </label>
        </div>
      )
    };

    const defaultProps: UsageViewProps = {
      usageHistoryData: props.usageHistoryData ?? buildUsageHistory(),
      usageHistoryStatsData: buildUsageHistoryStats(props.usageHistoryStatsData),
      isFetchingUsageHistory: false,
      isUsageHistoryError: false,
      isFetchingUsageHistoryStats: false,
      isUsageHistoryStatsError: false,
      dateRange: { from: new Date(), to: new Date() },
      onDateRangeChange: props.onDateRangeChange ?? jest.fn(),
      components: MockComponents(COMPONENTS, { ...defaultComponents, ...props.components }),
      ...props
    };

    render(<UsageView {...defaultProps} />);

    return defaultProps;
  }
});
