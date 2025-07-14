import "@testing-library/jest-dom";

import React from "react";
import { mock } from "jest-mock-extended";

import type { DailyUsageBarChartProps } from "@src/components/billing-usage/DailyUsageBarChart/DailyUsageBarChart";
import { COMPONENTS } from "@src/components/billing-usage/DailyUsageBarChart/DailyUsageBarChart";
import { DailyUsageBarChart } from "@src/components/billing-usage/DailyUsageBarChart/DailyUsageBarChart";

import { render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(DailyUsageBarChart.name, () => {
  beforeAll(() => {
    global.ResizeObserver = jest.fn().mockImplementation(() => mock<ResizeObserver>());
  });

  it("shows a spinner when fetching", () => {
    setup({ isFetching: true, data: [] });
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders a bar chart with data and applies pointer-events-none when fetching", async () => {
    const sample = [{ date: "2025-07-01", dailyUsdSpent: 25 }];
    const { barChartProps } = await setup({ isFetching: true, data: sample });

    expect(screen.getByRole("chart-container")).toHaveClass("pointer-events-none");
    expect(barChartProps.data).toEqual(sample);
  });

  it("renders a bar chart without disabling pointer events when not fetching", async () => {
    const sample = [{ date: "2025-07-01", dailyUsdSpent: 25 }];
    const { barChartProps } = await setup({ isFetching: false, data: sample });

    expect(screen.getByRole("chart-container")).not.toHaveClass("pointer-events-none");
    expect(barChartProps.data).toEqual(sample);
  });

  async function setup(props: { isFetching: boolean; data: Array<{ date: string; dailyUsdSpent: number }> }) {
    let barChartProps: React.ComponentProps<NonNullable<DailyUsageBarChartProps["components"]>["BarChart"]> = {};

    await render(
      <DailyUsageBarChart
        {...props}
        components={MockComponents(COMPONENTS, {
          BarChart: props => {
            barChartProps = props;
          }
        })}
      />
    );

    return { barChartProps };
  }
});
