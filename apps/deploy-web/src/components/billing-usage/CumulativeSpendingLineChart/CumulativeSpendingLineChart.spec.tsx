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

  function setup(props: { isFetching: boolean; data: Array<{ date: string; totalUsdSpent: number }> }) {
    const deps = MockComponents(DEPENDENCIES, {
      LineChart: vi.fn(ComponentMock) as unknown as typeof DEPENDENCIES.LineChart,
      Spinner: () => <div role="status" />
    });

    render(<CumulativeSpendingLineChart {...props} dependencies={deps} />);

    return { deps };
  }
});
