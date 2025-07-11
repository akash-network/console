import "@testing-library/jest-dom";

import React from "react";

import type { DailyUsageBarChartProps } from "@src/components/usage/DailyUsageBarChart/DailyUsageBarChart";
import { DailyUsageBarChart } from "@src/components/usage/DailyUsageBarChart/DailyUsageBarChart";

import { render, screen } from "@testing-library/react";

describe("DailyUsageBarChart", () => {
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

  it("renders a bar chart with data and applies pointer-events-none when fetching", async () => {
    const sample = [{ date: "2025-07-01", dailyUsdSpent: 25 }];
    const { barChartProps } = await setup({ isFetching: true, data: sample });

    expect(screen.queryByRole("chart-container")).toHaveClass("pointer-events-none");
    expect(barChartProps.data).toEqual(sample);
  });

  it("renders a bar chart without disabling pointer events when not fetching", async () => {
    const sample = [{ date: "2025-07-01", dailyUsdSpent: 25 }];
    const { barChartProps } = await setup({ isFetching: false, data: sample });

    expect(screen.queryByRole("chart-container")).not.toHaveClass("pointer-events-none");
    expect(barChartProps.data).toEqual(sample);
  });

  async function setup(props: { isFetching: boolean; data: Array<{ date: string; dailyUsdSpent: number }> }) {
    let barChartProps: React.ComponentProps<NonNullable<DailyUsageBarChartProps["dependencies"]>["BarChart"]> = {};

    const DEPENDENCIES: DailyUsageBarChartProps["dependencies"] = {
      BarChart: props => {
        barChartProps = props;
      }
    };

    await render(<DailyUsageBarChart {...props} dependencies={DEPENDENCIES} />);

    return { barChartProps };
  }
});
