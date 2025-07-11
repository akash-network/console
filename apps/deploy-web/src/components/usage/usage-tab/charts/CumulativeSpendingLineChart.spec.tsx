import "@testing-library/jest-dom";

import React from "react";
import { format, subDays } from "date-fns";

import { CumulativeSpendingLineChart } from "@src/components/usage/usage-tab/charts/CumulativeSpendingLineChart";

import { render, screen } from "@testing-library/react";

describe("CumulativeSpendingLineChart", () => {
  it("shows a spinner when fetching", () => {
    setup({ isFetching: true, data: [] });
    expect(screen.queryByTestId("spinner")).toBeInTheDocument();
  });

  it("renders a line chart with data and applies pointer-events-none when fetching", () => {
    const sample = [{ date: "2025-07-01", totalUsdSpent: 100 }];
    setup({ isFetching: true, data: sample });
    expect(screen.queryByTestId("chart-container")).toHaveClass("pointer-events-none");
    expect(screen.queryByTestId("line-chart")).toHaveTextContent(JSON.stringify(sample));
  });

  it("does not render trend indicator for fewer than 2 data points", () => {
    const sample = [{ date: "2025-07-01", totalUsdSpent: 100 }];
    setup({ isFetching: false, data: sample });
    expect(screen.queryByText(/Trending/)).toBeNull();
  });

  it("renders trending up when data increases", () => {
    const today = new Date();
    const yesterday = subDays(today, 1);
    const d1 = format(yesterday, "yyyy-MM-dd");
    const d2 = format(today, "yyyy-MM-dd");
    const data = [
      { date: d1, totalUsdSpent: 50 },
      { date: d2, totalUsdSpent: 100 }
    ];
    setup({ isFetching: false, data });
    expect(screen.queryByText(/Trending up by 100%/)).toBeInTheDocument();
    expect(screen.queryByTestId("up-icon")).toBeInTheDocument();
  });

  it("renders trending down when data decreases", () => {
    const today = new Date();
    const yesterday = subDays(today, 1);
    const d1 = format(yesterday, "yyyy-MM-dd");
    const d2 = format(today, "yyyy-MM-dd");
    const data = [
      { date: d1, totalUsdSpent: 100 },
      { date: d2, totalUsdSpent: 50 }
    ];
    setup({ isFetching: false, data });
    expect(screen.queryByText(/Trending down by 50%/)).toBeInTheDocument();
    expect(screen.queryByTestId("down-icon")).toBeInTheDocument();
  });

  function setup(props: { isFetching: boolean; data: Array<{ date: string; totalUsdSpent: number }> }) {
    const dependencies = {
      Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      CardFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
      ChartContainer: ({ children, className }: { children: React.ReactNode; className?: string }) => (
        <div data-testid="chart-container" className={className}>
          {children}
        </div>
      ),
      ChartTooltip: ({ content }: { content: React.ReactNode }) => <div data-testid="chart-tooltip">{content}</div>,
      ChartTooltipContent: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip-content">{children}</div>,
      Spinner: () => <div data-testid="spinner" />,
      LineChart: ({ data }: { data: Array<{ date: string; totalUsdSpent: number }>; margin?: object }) => (
        <div data-testid="line-chart">{JSON.stringify(data)}</div>
      ),
      Line: () => <div />,
      CartesianGrid: () => <div />,
      XAxis: () => <div />,
      GraphUp: () => <span data-testid="up-icon" />,
      GraphDown: () => <span data-testid="down-icon" />
    };

    render(<CumulativeSpendingLineChart {...props} dependencies={dependencies} />);
  }
});
