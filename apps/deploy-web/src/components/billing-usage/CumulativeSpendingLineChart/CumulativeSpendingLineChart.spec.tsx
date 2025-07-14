import "@testing-library/jest-dom";

import React from "react";
import { mock } from "jest-mock-extended";

import type { CumulativeSpendingLineChartProps } from "@src/components/billing-usage/CumulativeSpendingLineChart/CumulativeSpendingLineChart";
import { COMPONENTS } from "@src/components/billing-usage/CumulativeSpendingLineChart/CumulativeSpendingLineChart";
import { CumulativeSpendingLineChart } from "@src/components/billing-usage/CumulativeSpendingLineChart/CumulativeSpendingLineChart";

import { render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(CumulativeSpendingLineChart.name, () => {
  beforeAll(() => {
    global.ResizeObserver = jest.fn().mockImplementation(() => mock<ResizeObserver>());
  });

  it("shows a spinner when fetching", () => {
    setup({ isFetching: true, data: [] });
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders a line chart with data and applies pointer-events-none when fetching", () => {
    const sample = [{ date: "2025-07-01", totalUsdSpent: 100 }];
    const { lineChartProps } = setup({ isFetching: true, data: sample });

    expect(screen.getByRole("chart-container")).toHaveClass("pointer-events-none");
    expect(lineChartProps.data).toEqual(sample);
  });

  it("renders a line chart without disabling pointer events when not fetching", async () => {
    const sample = [{ date: "2025-07-01", totalUsdSpent: 25 }];
    const { lineChartProps } = await setup({ isFetching: false, data: sample });

    expect(screen.getByRole("chart-container")).not.toHaveClass("pointer-events-none");
    expect(lineChartProps.data).toEqual(sample);
  });

  function setup(props: { isFetching: boolean; data: Array<{ date: string; totalUsdSpent: number }> }) {
    let lineChartProps: React.ComponentProps<NonNullable<CumulativeSpendingLineChartProps["components"]>["LineChart"]> = {};

    render(
      <CumulativeSpendingLineChart
        {...props}
        components={MockComponents(COMPONENTS, {
          LineChart: props => {
            lineChartProps = props;
          }
        })}
      />
    );

    return { lineChartProps };
  }
});
