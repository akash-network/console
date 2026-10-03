import React, { type ComponentPropsWithoutRef, forwardRef, type ReactElement } from "react";
import { IntlProvider } from "react-intl";
import { format, startOfToday, subDays } from "date-fns";
import { describe, expect, it, vi } from "vitest";

import type { DailySpend } from "./DailySpendChart";
import { DailySpendChart, DailySpendTooltip, DEPENDENCIES } from "./DailySpendChart";

import { render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(DailySpendChart.name, () => {
  it("totals the daily spend of the range", () => {
    setup({ days: [buildDay(1, 12.5), buildDay(0, 7.25)] });

    expect(screen.getByText("$19.75")).toBeInTheDocument();
  });

  it("charts every day of the range", () => {
    const days = [buildDay(1, 12.5), buildDay(0, 7.25)];
    const { chartProps, Skeleton } = setup({ days });

    expect(chartProps()).toEqual(expect.objectContaining({ data: days, barCategoryGap: 4 }));
    expect(Skeleton).not.toHaveBeenCalled();
  });

  it("narrows the gap between bars for ranges longer than a month", () => {
    const { chartProps } = setup({ days: Array.from({ length: 32 }, (_, index) => buildDay(31 - index, 1)) });

    expect(chartProps()).toEqual(expect.objectContaining({ barCategoryGap: 1 }));
  });

  it("keeps the wide gap between bars for a month", () => {
    const { chartProps } = setup({ days: Array.from({ length: 31 }, (_, index) => buildDay(30 - index, 1)) });

    expect(chartProps()).toEqual(expect.objectContaining({ barCategoryGap: 4 }));
  });

  it("labels the first and middle days and calls the last one today", () => {
    setup({ days: Array.from({ length: 30 }, (_, index) => buildDay(29 - index, 1)) });

    expect(screen.getByText(format(subDays(startOfToday(), 29), "MMM d"))).toBeInTheDocument();
    expect(screen.getByText(format(subDays(startOfToday(), 14), "MMM d"))).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("labels the last day by its date when the range ends before today", () => {
    setup({ days: [buildDay(10, 1), buildDay(9, 1), buildDay(8, 1)] });

    expect(screen.getByText(format(subDays(startOfToday(), 8), "MMM d"))).toBeInTheDocument();
    expect(screen.queryByText("Today")).not.toBeInTheDocument();
  });

  it("labels a single day once", () => {
    setup({ days: [buildDay(0, 1)] });

    expect(screen.getAllByText("Today")).toHaveLength(1);
  });

  it("shows placeholders instead of figures while the usage loads", () => {
    const { Skeleton } = setup({ days: [], isLoading: true });

    expect(Skeleton).toHaveBeenCalled();
    expect(screen.queryByText("$0.00")).not.toBeInTheDocument();
    expect(screen.queryByText("No spend in this range")).not.toBeInTheDocument();
  });

  it("explains a failed load in place of the chart", () => {
    const { ChartContainer } = setup({ days: [], isError: true });

    expect(screen.getByText("Daily spend couldn't be loaded. Refresh the page to try again.")).toBeInTheDocument();
    expect(screen.queryByText("$0.00")).not.toBeInTheDocument();
    expect(ChartContainer).not.toHaveBeenCalled();
  });

  it("says so when nothing was spent in the range", () => {
    const { ChartContainer } = setup({ days: [buildDay(1, 0), buildDay(0, 0)] });

    expect(screen.getByText("No spend in this range")).toBeInTheDocument();
    expect(ChartContainer).not.toHaveBeenCalled();
  });

  it("says so when the range has no usage at all", () => {
    setup({ days: [] });

    expect(screen.getByText("No spend in this range")).toBeInTheDocument();
  });

  it("keeps the range toggle while the usage loads", () => {
    setup({ days: [], isLoading: true, rangeToggle: <button type="button">7d</button> });

    expect(screen.getByRole("button", { name: "7d" })).toBeInTheDocument();
  });

  function setup(input: { days: DailySpend[]; isLoading?: boolean; isError?: boolean; rangeToggle?: React.ReactNode }) {
    const renderChartContainer = vi.fn((_props: ComponentPropsWithoutRef<typeof DEPENDENCIES.ChartContainer>) => null);
    const ChartContainer = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof DEPENDENCIES.ChartContainer>>(props => renderChartContainer(props));
    const dependencies = MockComponents(DEPENDENCIES, { ChartContainer });
    const chartProps = () => (renderChartContainer.mock.lastCall![0].children as ReactElement).props;

    render(
      <IntlProvider locale="en-US">
        <DailySpendChart
          data={input.days}
          isLoading={input.isLoading ?? false}
          isError={input.isError ?? false}
          rangeToggle={input.rangeToggle}
          dependencies={dependencies}
        />
      </IntlProvider>
    );

    return { ...dependencies, ChartContainer: renderChartContainer, chartProps };
  }
});

describe(DailySpendTooltip.name, () => {
  it("shows the hovered day's date and spend", () => {
    render(
      <IntlProvider locale="en-US">
        <DailySpendTooltip active payload={[{ payload: { date: "2026-10-01", dailyUsdSpent: 12.5 } }]} />
      </IntlProvider>
    );

    expect(screen.getByText("Oct 1, 2026")).toBeInTheDocument();
    expect(screen.getByText("$12.50")).toBeInTheDocument();
  });

  it("renders nothing without a hovered day's data", () => {
    const { container } = render(
      <IntlProvider locale="en-US">
        <DailySpendTooltip active />
      </IntlProvider>
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing while no day is hovered", () => {
    const { container } = render(
      <IntlProvider locale="en-US">
        <DailySpendTooltip active={false} payload={[{ payload: { date: "2026-10-01", dailyUsdSpent: 12.5 } }]} />
      </IntlProvider>
    );

    expect(container).toBeEmptyDOMElement();
  });
});

function buildDay(daysAgo: number, dailyUsdSpent: number): DailySpend {
  return { date: format(subDays(startOfToday(), daysAgo), "yyyy-MM-dd"), dailyUsdSpent };
}
