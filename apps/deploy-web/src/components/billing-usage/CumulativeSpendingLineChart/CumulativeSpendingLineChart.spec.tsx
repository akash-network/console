import React from "react";
import { describe, expect, it, vi } from "vitest";

import { DEPENDENCIES } from "@src/components/billing-usage/CumulativeSpendingLineChart/CumulativeSpendingLineChart";
import { CumulativeSpendingLineChart } from "@src/components/billing-usage/CumulativeSpendingLineChart/CumulativeSpendingLineChart";

import { render, screen } from "@testing-library/react";
import { ComponentMock, MockComponents } from "@tests/unit/mocks";

describe(CumulativeSpendingLineChart.name, () => {
  it("shows a spinner when fetching", () => {
    setup({ isFetching: true, data: [] });
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders a line chart with data and applies pointer-events-none when fetching", () => {
    const sample = [{ date: "2025-07-01", totalUsdSpent: 100 }];
    const { deps } = setup({ isFetching: true, data: sample });

    expect(deps.ChartContainer).toHaveBeenCalledWith(expect.objectContaining({ className: expect.stringContaining("pointer-events-none") }), {});
    expect(deps.LineChart.mock.calls.at(-1)?.at(0)?.data).toEqual(sample);
  });

  it("renders a line chart without disabling pointer events when not fetching", async () => {
    const sample = [{ date: "2025-07-01", totalUsdSpent: 25 }];
    const { deps } = await setup({ isFetching: false, data: sample });

    expect(deps.ChartContainer).toHaveBeenCalledWith(expect.objectContaining({ className: expect.not.stringContaining("pointer-events-none") }), {});
    expect(deps.LineChart.mock.calls.at(-1)?.at(0)?.data).toEqual(sample);
  });

  it("formats axis ticks from the date-only value in local time regardless of timezone", () => {
    const { deps } = setup({ isFetching: false, data: [{ date: "2025-07-01", totalUsdSpent: 100 }] });
    const tickFormatter = deps.XAxis.mock.calls.at(-1)?.[0]?.tickFormatter as (value: string, index: number) => string;

    expect(withTimezone("America/Los_Angeles", () => tickFormatter("2025-07-01", 0))).toBe("7/1");
    expect(withTimezone("Asia/Tokyo", () => tickFormatter("2025-07-01", 0))).toBe("7/1");
  });

  it("formats the tooltip label from the date-only value in local time regardless of timezone", () => {
    const { deps } = setup({ isFetching: false, data: [{ date: "2025-07-01", totalUsdSpent: 100 }] });
    const content = deps.ChartTooltip.mock.calls.at(-1)?.[0]?.content as React.ReactElement<{ labelFormatter: (value: string) => string }>;
    const labelFormatter = content.props.labelFormatter;

    expect(withTimezone("America/Los_Angeles", () => labelFormatter("2025-07-01"))).toBe("Jul 1, 2025");
    expect(withTimezone("Asia/Tokyo", () => labelFormatter("2025-07-01"))).toBe("Jul 1, 2025");
  });

  it("returns the raw value when it is not a parseable date", () => {
    const { deps } = setup({ isFetching: false, data: [{ date: "n/a", totalUsdSpent: 0 }] });
    const tickFormatter = deps.XAxis.mock.calls.at(-1)?.[0]?.tickFormatter as (value: string, index: number) => string;

    expect(tickFormatter("n/a", 0)).toBe("n/a");
  });

  function withTimezone<T>(timeZone: string, fn: () => T): T {
    const original = process.env.TZ;
    process.env.TZ = timeZone;
    try {
      return fn();
    } finally {
      process.env.TZ = original;
    }
  }

  function setup(props: { isFetching: boolean; data: Array<{ date: string; totalUsdSpent: number }> }) {
    const deps = MockComponents(DEPENDENCIES, {
      LineChart: vi.fn(ComponentMock) as unknown as typeof DEPENDENCIES.LineChart,
      Spinner: () => <div role="status" />
    });

    render(<CumulativeSpendingLineChart {...props} dependencies={deps} />);

    return { deps };
  }
});
