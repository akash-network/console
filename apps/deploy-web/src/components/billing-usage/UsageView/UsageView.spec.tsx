import "@testing-library/jest-dom";

import React from "react";
import type { LinearProgressProps } from "@mui/material";

import type { CumulativeSpendingLineChartProps } from "@src/components/billing-usage/CumulativeSpendingLineChart/CumulativeSpendingLineChart";
import type { DailyUsageBarChartProps } from "@src/components/billing-usage/DailyUsageBarChart/DailyUsageBarChart";
import { COMPONENTS, UsageView, type UsageViewProps } from "@src/components/billing-usage/UsageView/UsageView";

import { render, screen } from "@testing-library/react";
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
      LinearProgress: (props: Omit<LinearProgressProps, "ref">) => <div role="progressbar" {...props} />
    };

    const defaultProps: UsageViewProps = {
      usageHistoryData: props.usageHistoryData ?? buildUsageHistory(),
      usageHistoryStatsData: buildUsageHistoryStats(props.usageHistoryStatsData),
      isFetchingUsageHistory: false,
      isUsageHistoryError: false,
      isFetchingUsageHistoryStats: false,
      isUsageHistoryStatsError: false,
      components: MockComponents(COMPONENTS, { ...defaultComponents, ...props.components }),
      ...props
    };

    render(<UsageView {...defaultProps} />);

    return defaultProps;
  }
});
