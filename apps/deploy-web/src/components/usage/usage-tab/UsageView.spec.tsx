import "@testing-library/jest-dom";

import React from "react";
import type { LinearProgressProps } from "@mui/material";

import type { CumulativeSpendingLineChartProps } from "@src/components/usage/usage-tab/charts/CumulativeSpendingLineChart";
import type { DailyUsageBarChartProps } from "@src/components/usage/usage-tab/charts/DailyUsageBarChart";
import { UsageView, type UsageViewProps } from "@src/components/usage/usage-tab/UsageView";

import { render, screen } from "@testing-library/react";
import { buildUsageHistory, buildUsageHistoryStats } from "@tests/seeders/usage";

jest.mock("react-intl", () => ({
  FormattedNumber: ({ value }: { value: number }) => <span>{value}</span>
}));

jest.mock("@src/components/shared/Title", () => ({
  Title: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

jest.mock("@src/components/usage/usage-tab/charts/DailyUsageBarChart", () => ({
  DailyUsageBarChart: ({ data, isFetching }: DailyUsageBarChartProps) => (
    <div data-testid="daily-chart" data-fetching={String(isFetching)}>
      {JSON.stringify(data)}
    </div>
  )
}));

jest.mock("@src/components/usage/usage-tab/charts/CumulativeSpendingLineChart", () => ({
  CumulativeSpendingLineChart: ({ data, isFetching }: CumulativeSpendingLineChartProps) => (
    <div data-testid="cumulative-chart" data-fetching={String(isFetching)}>
      {JSON.stringify(data)}
    </div>
  )
}));

jest.mock("@mui/material/LinearProgress", () => ({
  __esModule: true,
  default: (props: Omit<LinearProgressProps, "ref">) => <div role="progressbar" {...props} />
}));

describe(UsageView.name, () => {
  function setup(props: Partial<UsageViewProps> = {}) {
    const defaultProps = {
      usageHistoryData: buildUsageHistory(props.usageHistoryData),
      usageHistoryStatsData: buildUsageHistoryStats(props.usageHistoryStatsData),
      isFetchingUsageHistory: false,
      isUsageHistoryError: false,
      isFetchingUsageHistoryStats: false,
      isUsageHistoryStatsError: false,
      ...props
    };
    render(<UsageView {...defaultProps} />);
    return defaultProps;
  }

  it("renders an error message when stats fail to load", () => {
    setup({ isUsageHistoryStatsError: true });
    expect(screen.queryByText("Error loading usage stats")).toBeInTheDocument();
  });

  it("renders two progress bars while stats are fetching", () => {
    setup({ isFetchingUsageHistoryStats: true });
    const bars = screen.queryAllByRole("progressbar");
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
    expect(screen.queryByText(usageHistoryStatsData.totalSpent)).toBeInTheDocument();
    expect(
      screen.queryByText((_, element) => {
        return element?.textContent === "7 average per day";
      })
    ).toBeInTheDocument();
    expect(screen.queryByText("3")).toBeInTheDocument();

    expect(
      screen.queryByText((_, element) => {
        return element?.textContent === "0.5 average per day";
      })
    ).toBeInTheDocument();
  });

  it("renders an error message when history data fails to load", () => {
    setup({ isUsageHistoryError: true });
    expect(screen.queryByText("Error loading usage data")).toBeInTheDocument();
  });

  it("renders charts with correct data and loading state", () => {
    const { usageHistoryData } = setup({ isFetchingUsageHistory: true });

    const daily = screen.queryByTestId("daily-chart");
    expect(daily).toHaveAttribute("data-fetching", "true");
    expect(daily).toHaveTextContent(JSON.stringify(usageHistoryData));

    const cumulative = screen.queryByTestId("cumulative-chart");
    expect(cumulative).toHaveAttribute("data-fetching", "true");
  });

  it("renders charts in non-loading state by default", () => {
    setup();
    expect(screen.queryByTestId("daily-chart")).toHaveAttribute("data-fetching", "false");
    expect(screen.queryByTestId("cumulative-chart")).toHaveAttribute("data-fetching", "false");
  });
});
