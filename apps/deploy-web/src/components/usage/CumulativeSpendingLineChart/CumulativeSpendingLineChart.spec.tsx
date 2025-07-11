import "@testing-library/jest-dom";

import React from "react";

import type { CumulativeSpendingLineChartProps } from "@src/components/usage/CumulativeSpendingLineChart/CumulativeSpendingLineChart";
import { CumulativeSpendingLineChart } from "@src/components/usage/CumulativeSpendingLineChart/CumulativeSpendingLineChart";

import { render, screen } from "@testing-library/react";

describe("CumulativeSpendingLineChart", () => {
  beforeAll(() => {
    global.ResizeObserver = class MockedResizeObserver {
      observe = jest.fn();
      unobserve = jest.fn();
      disconnect = jest.fn();
    };
  });

  it("shows a spinner when fetching", () => {
    setup({ isFetching: true, data: [] });
    expect(screen.queryByRole("status")).toBeInTheDocument();
  });

  it("renders a line chart with data and applies pointer-events-none when fetching", () => {
    const sample = [{ date: "2025-07-01", totalUsdSpent: 100 }];
    const { lineChartProps } = setup({ isFetching: true, data: sample });

    expect(screen.queryByRole("chart-container")).toHaveClass("pointer-events-none");
    expect(lineChartProps.data).toEqual(sample);
  });

  it("renders a line chart without disabling pointer events when not fetching", async () => {
    const sample = [{ date: "2025-07-01", totalUsdSpent: 25 }];
    const { lineChartProps } = await setup({ isFetching: false, data: sample });

    expect(screen.queryByRole("chart-container")).not.toHaveClass("pointer-events-none");
    expect(lineChartProps.data).toEqual(sample);
  });

  function setup(props: { isFetching: boolean; data: Array<{ date: string; totalUsdSpent: number }> }) {
    let lineChartProps: React.ComponentProps<NonNullable<CumulativeSpendingLineChartProps["dependencies"]>["LineChart"]> = {};

    const DEPENDENCIES: CumulativeSpendingLineChartProps["dependencies"] = {
      LineChart: props => {
        lineChartProps = props;
      }
    };

    render(<CumulativeSpendingLineChart {...props} dependencies={DEPENDENCIES} />);

    return { lineChartProps };
  }
});
