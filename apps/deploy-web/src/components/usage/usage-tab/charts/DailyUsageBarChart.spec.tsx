import "@testing-library/jest-dom";

import React from "react";

import { render, screen } from "@testing-library/react";

jest.mock("@akashnetwork/ui/components", () => ({
  Spinner: () => <div data-testid="spinner" />,
  ChartContainer: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="chart-container" className={className}>
      {children}
    </div>
  ),
  ChartTooltip: ({ content }: { content: React.ReactNode }) => <div data-testid="chart-tooltip">{content}</div>,
  ChartTooltipContent: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip-content">{children}</div>,
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

jest.mock("recharts", () => ({
  CartesianGrid: () => <div />,
  XAxis: () => <div />,
  BarChart: ({ data }: { data: Array<{ date: string; dailyUsdSpent: number }> }) => <div data-testid="bar-chart">{JSON.stringify(data)}</div>,
  Bar: () => <div />
}));

import { DailyUsageBarChart } from "@src/components/usage/usage-tab/charts/DailyUsageBarChart";

describe("DailyUsageBarChart", () => {
  it("shows a spinner when fetching", () => {
    render(<DailyUsageBarChart isFetching data={[]} />);
    expect(screen.getByTestId("spinner")).toBeInTheDocument();
  });

  it("renders a bar chart with data and applies pointer-events-none when fetching", () => {
    const sample = [{ date: "2025-07-01", dailyUsdSpent: 25 }];
    render(<DailyUsageBarChart isFetching data={sample} />);
    expect(screen.getByTestId("chart-container")).toHaveClass("pointer-events-none");
    expect(screen.getByTestId("bar-chart")).toHaveTextContent(JSON.stringify(sample));
  });

  it("renders a bar chart without disabling pointer events when not fetching", () => {
    const sample = [{ date: "2025-07-01", dailyUsdSpent: 25 }];
    render(<DailyUsageBarChart isFetching={false} data={sample} />);
    expect(screen.getByTestId("chart-container")).not.toHaveClass("pointer-events-none");
    expect(screen.getByTestId("bar-chart")).toHaveTextContent(JSON.stringify(sample));
  });
});
