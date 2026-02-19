import { describe, expect, it } from "vitest";

import type { DailyUsageBarChartProps } from "@src/components/billing-usage/DailyUsageBarChart/DailyUsageBarChart";
import { DailyUsageBarChart, DEPENDENCIES } from "@src/components/billing-usage/DailyUsageBarChart/DailyUsageBarChart";

import { render, screen } from "@testing-library/react";
import { MockComponents } from "@tests/unit/mocks";

describe(DailyUsageBarChart.name, () => {
  it("shows a spinner when fetching", () => {
    setup({ isFetching: true, data: [] });
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders a bar chart with data and applies pointer-events-none when fetching", async () => {
    const sample = [{ date: "2025-07-01", dailyUsdSpent: 25 }];
    const { deps } = await setup({ isFetching: true, data: sample });

    expect(deps.ChartContainer).toHaveBeenCalledWith(expect.objectContaining({ className: expect.stringContaining("pointer-events-none") }), {});
    expect(deps.BarChart.mock.calls.at(-1)?.at(0)?.data).toEqual(sample);
  });

  it("renders a bar chart without disabling pointer events when not fetching", async () => {
    const sample = [{ date: "2025-07-01", dailyUsdSpent: 25 }];
    const { deps } = await setup({ isFetching: false, data: sample });

    expect(deps.ChartContainer).toHaveBeenCalledWith(expect.objectContaining({ className: expect.not.stringContaining("pointer-events-none") }), {});
    expect(deps.BarChart.mock.calls.at(-1)?.at(0)?.data).toEqual(sample);
  });

  async function setup(props: DailyUsageBarChartProps) {
    const deps = MockComponents(DEPENDENCIES, {
      Spinner: () => <div role="status" />
    });
    render(<DailyUsageBarChart {...props} dependencies={deps} />);

    return { deps };
  }
});
