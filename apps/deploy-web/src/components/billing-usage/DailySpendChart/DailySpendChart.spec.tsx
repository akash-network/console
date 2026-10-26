import React, { type ComponentPropsWithoutRef, forwardRef, type ReactElement } from "react";
import { IntlProvider } from "react-intl";
import { format, parseISO } from "date-fns";
import { Bar, type BarProps } from "recharts";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import type { DailySpend, SpendSeries } from "./DailySpendChart";
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

    expect(screen.getByText(format(parseISO(utcDateDaysAgo(29)), "MMM d"))).toBeInTheDocument();
    expect(screen.getByText(format(parseISO(utcDateDaysAgo(14)), "MMM d"))).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("labels the last day by its date when the range ends before today", () => {
    setup({ days: [buildDay(10, 1), buildDay(9, 1), buildDay(8, 1)] });

    expect(screen.getByText(format(parseISO(utcDateDaysAgo(8)), "MMM d"))).toBeInTheDocument();
    expect(screen.queryByText("Today")).not.toBeInTheDocument();
  });

  it("calls the last day today when it is today's UTC date, as it is west of UTC in the evening", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-24T03:00:00.000Z"));
    onTestFinished(() => {
      vi.useRealTimers();
    });

    setup({ days: ["2026-10-22", "2026-10-23", "2026-10-24"].map(date => ({ date, dailyUsdSpent: 1 })) });

    expect(screen.getByText("Oct 22")).toBeInTheDocument();
    expect(screen.getByText("Today")).toBeInTheDocument();
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

  it("says what each bar adds up when no caption is given", () => {
    setup({ days: [buildDay(0, 1)] });

    expect(screen.getByText("Each bar is one day's total across all deployments")).toBeInTheDocument();
  });

  it("shows the caption it is given", () => {
    setup({ days: [buildDay(0, 1)], caption: "Each bar is one day's total for Storefront" });

    expect(screen.getByText("Each bar is one day's total for Storefront")).toBeInTheDocument();
  });

  it("draws each day as one bar without series", () => {
    const { bars } = setup({ days: [buildDay(0, 1)] });

    expect(bars()).toHaveLength(1);
    expect(bars()[0]).toEqual(expect.objectContaining({ dataKey: "dailyUsdSpent", isAnimationActive: false }));
    expect(screen.queryByRole("list", { name: "Legend" })).not.toBeInTheDocument();
  });

  it("stacks the series of each day from the darkest shade to the lightest", () => {
    const day = buildDay(0, 2.5, { storefront: 2, marketing: 0.5 });
    const { bars } = setup({ days: [day], series: buildSeries() });

    expect(bars().map(({ stackId, fill, isAnimationActive }) => ({ stackId, fill, isAnimationActive }))).toEqual([
      { stackId: "daily-spend", fill: shadeOf(100), isAnimationActive: false },
      { stackId: "daily-spend", fill: shadeOf(63), isAnimationActive: false },
      { stackId: "daily-spend", fill: shadeOf(25), isAnimationActive: false }
    ]);
    expect(bars().map(({ dataKey }) => (dataKey as (spend: DailySpend) => number)(day))).toEqual([2, 0.5, 0]);
    expect(bars().map(({ dataKey }) => (dataKey as (spend: DailySpend) => number)(buildDay(1, 0)))).toEqual([0, 0, 0]);
  });

  it("fills a lone series with the full foreground", () => {
    const { bars } = setup({ days: [buildDay(0, 1, { storefront: 1 })], series: [{ key: "storefront", label: "Storefront" }] });

    expect(bars()[0].fill).toBe(shadeOf(100));
  });

  it("lists the series in a legend that leaves narrowing to a project to the project picker", () => {
    setup({ days: [buildDay(0, 2.5, { storefront: 2, marketing: 0.5 })], series: buildSeries() });

    expect(screen.getByRole("list", { name: "Legend" })).toHaveTextContent("StorefrontMarketingUnassigned");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("leaves the legend out of a range without spend", () => {
    setup({ days: [buildDay(0, 0)], series: buildSeries() });

    expect(screen.queryByRole("list", { name: "Legend" })).not.toBeInTheDocument();
  });

  function setup(input: {
    days: DailySpend[];
    isLoading?: boolean;
    isError?: boolean;
    rangeToggle?: React.ReactNode;
    series?: SpendSeries[];
    caption?: string;
  }) {
    const renderChartContainer = vi.fn((_props: ComponentPropsWithoutRef<typeof DEPENDENCIES.ChartContainer>) => null);
    const ChartContainer = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof DEPENDENCIES.ChartContainer>>(props => renderChartContainer(props));
    const dependencies = MockComponents(DEPENDENCIES, { ChartContainer });
    const chartProps = () => (renderChartContainer.mock.lastCall![0].children as ReactElement<{ children: React.ReactNode }>).props;
    const bars = () =>
      React.Children.toArray(chartProps().children)
        .filter((child): child is ReactElement<BarProps> => (child as ReactElement).type === Bar)
        .map(({ props }) => props);

    render(
      <IntlProvider locale="en-US">
        <DailySpendChart
          data={input.days}
          isLoading={input.isLoading ?? false}
          isError={input.isError ?? false}
          rangeToggle={input.rangeToggle}
          series={input.series}
          caption={input.caption}
          dependencies={dependencies}
        />
      </IntlProvider>
    );

    return { ...dependencies, ChartContainer: renderChartContainer, chartProps, bars };
  }

  function buildSeries(): SpendSeries[] {
    return [
      { key: "storefront", label: "Storefront" },
      { key: "marketing", label: "Marketing" },
      { key: "unassigned", label: "Unassigned" }
    ];
  }

  function shadeOf(foregroundPercent: number) {
    return `color-mix(in oklab, hsl(var(--foreground)) ${foregroundPercent}%, hsl(var(--muted)))`;
  }
});

describe(DailySpendTooltip.name, () => {
  it("shows the hovered day's date and spend", () => {
    render(
      <IntlProvider locale="en-US">
        <DailySpendTooltip active payload={[{ payload: { date: "2026-10-01", dailyUsdSpent: 12.5 } }]} series={[]} />
      </IntlProvider>
    );

    expect(screen.getByText("Oct 1, 2026")).toBeInTheDocument();
    expect(screen.getByText("$12.50")).toBeInTheDocument();
  });

  it("breaks the hovered day down by the series that spent on it", () => {
    const series = [
      { key: "storefront", label: "Storefront" },
      { key: "marketing", label: "Marketing" },
      { key: "unassigned", label: "Unassigned" }
    ];
    const day = { date: "2026-10-01", dailyUsdSpent: 2.5, spendBySeries: { storefront: 2, marketing: 0.5, unassigned: 0 } };
    render(
      <IntlProvider locale="en-US">
        <DailySpendTooltip active payload={[{ payload: day }]} series={series} />
      </IntlProvider>
    );

    expect(screen.getByText("Storefront").parentElement).toHaveTextContent("Storefront$2.00");
    expect(screen.getByText("Marketing").parentElement).toHaveTextContent("Marketing$0.50");
    expect(screen.queryByText("Unassigned")).not.toBeInTheDocument();
  });

  it("shows only the total of a hovered day that no series spent on", () => {
    render(
      <IntlProvider locale="en-US">
        <DailySpendTooltip active payload={[{ payload: { date: "2026-10-01", dailyUsdSpent: 0 } }]} series={[{ key: "storefront", label: "Storefront" }]} />
      </IntlProvider>
    );

    expect(screen.getByText("$0.00")).toBeInTheDocument();
    expect(screen.queryByText("Storefront")).not.toBeInTheDocument();
  });

  it("renders nothing without a hovered day's data", () => {
    const { container } = render(
      <IntlProvider locale="en-US">
        <DailySpendTooltip active series={[]} />
      </IntlProvider>
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing while no day is hovered", () => {
    const { container } = render(
      <IntlProvider locale="en-US">
        <DailySpendTooltip active={false} payload={[{ payload: { date: "2026-10-01", dailyUsdSpent: 12.5 } }]} series={[]} />
      </IntlProvider>
    );

    expect(container).toBeEmptyDOMElement();
  });
});

function buildDay(daysAgo: number, dailyUsdSpent: number, spendBySeries?: Record<string, number>): DailySpend {
  return { date: utcDateDaysAgo(daysAgo), dailyUsdSpent, spendBySeries };
}

function utcDateDaysAgo(daysAgo: number) {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
