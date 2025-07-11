import "@testing-library/jest-dom";

import React from "react";
import type { ChartConfig } from "@akashnetwork/ui/components";

import { DailyUsageBarChart } from "@src/components/usage/usage-tab/charts/DailyUsageBarChart";

import { render, screen } from "@testing-library/react";

describe("DailyUsageBarChart", () => {
  it("shows a spinner when fetching", () => {
    setup({ isFetching: true, data: [] });
    expect(screen.queryByTestId("spinner")).toBeInTheDocument();
  });

  it("renders a bar chart with data and applies pointer-events-none when fetching", () => {
    const sample = [{ date: "2025-07-01", dailyUsdSpent: 25 }];
    setup({ isFetching: true, data: sample });
    expect(screen.queryByTestId("chart-container")).toHaveClass("pointer-events-none");
    expect(screen.queryByTestId("bar-chart")).toHaveTextContent(JSON.stringify(sample));
  });

  it("renders a bar chart without disabling pointer events when not fetching", () => {
    const sample = [{ date: "2025-07-01", dailyUsdSpent: 25 }];
    setup({ isFetching: false, data: sample });
    expect(screen.queryByTestId("chart-container")).not.toHaveClass("pointer-events-none");
    expect(screen.queryByTestId("bar-chart")).toHaveTextContent(JSON.stringify(sample));
  });

  function setup(props: { isFetching: boolean; data: Array<{ date: string; dailyUsdSpent: number }> }) {
    const dependencies = {
      Card: (props: { children: React.ReactNode }) => <div data-testid="card">{props.children}</div>,
      CardContent: (props: { children: React.ReactNode }) => <div data-testid="card-content">{props.children}</div>,
      CardHeader: (props: { children: React.ReactNode }) => <div data-testid="card-header">{props.children}</div>,
      CardTitle: (props: { children: React.ReactNode }) => <div data-testid="card-title">{props.children}</div>,
      Spinner: () => <div data-testid="spinner" />,
      BarChart: (props: { data: Array<{ date: string; dailyUsdSpent: number }> }) => <div data-testid="bar-chart">{JSON.stringify(props.data)}</div>,
      Bar: () => <div data-testid="bar" />,
      CartesianGrid: () => <div data-testid="cartesian-grid" />,
      XAxis: () => <div data-testid="x-axis" />,
      ChartContainer: (props: { config: ChartConfig; className?: string }) => (
        <div data-testid="chart-container" className={props.className}>
          {props.children}
        </div>
      ),
      ChartTooltip: (props: { content: React.ReactNode }) => <div data-testid="chart-tooltip">{props.content}</div>,
      ChartTooltipContent: (props: { children: React.ReactNode }) => <div data-testid="tooltip-content">{props.children}</div>
    };

    render(<DailyUsageBarChart {...props} dependencies={dependencies} />);
  }
});
