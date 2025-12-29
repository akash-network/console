import "@testing-library/jest-dom";

import React from "react";
import { subDays } from "date-fns";

import type { TrendIndicatorProps } from "@src/components/billing-usage/TrendIndicator/TrendIndicator";
import { TrendIndicator } from "@src/components/billing-usage/TrendIndicator/TrendIndicator";
import type { UsageHistory } from "@src/types";

import { render, screen } from "@testing-library/react";
import { buildUsageHistoryItem } from "@tests/seeders/usage";

describe(TrendIndicator.name, () => {
  it("renders increased trend indicator when last value is higher than first value", () => {
    setup({
      isFetching: false,
      data: [
        buildUsageHistoryItem({ date: subDays(new Date(), 5), totalUsdSpent: 100 }),
        buildUsageHistoryItem({ date: subDays(new Date(), 3), totalUsdSpent: 120 }),
        buildUsageHistoryItem({ date: subDays(new Date(), 1), totalUsdSpent: 150 })
      ],
      field: "totalUsdSpent"
    });

    expect(screen.getByText("Trending up by 50%")).toBeInTheDocument();
    expect(screen.getByText("Graph Up")).toBeInTheDocument();
    expect(screen.queryByText("Graph Down")).not.toBeInTheDocument();
    expect(screen.queryByText("today")).not.toBeInTheDocument();
  });

  it("renders decreased trend indicator when last value is lower than first value", () => {
    setup({
      isFetching: false,
      data: [
        buildUsageHistoryItem({ date: subDays(new Date(), 5), totalUsdSpent: 300 }),
        buildUsageHistoryItem({ date: subDays(new Date(), 3), totalUsdSpent: 200 }),
        buildUsageHistoryItem({ date: subDays(new Date(), 1), totalUsdSpent: 100 })
      ],
      field: "totalUsdSpent"
    });

    expect(screen.getByText("Trending down by 66.67%")).toBeInTheDocument();
    expect(screen.queryByText("Graph Up")).not.toBeInTheDocument();
    expect(screen.getByText("Graph Down")).toBeInTheDocument();
    expect(screen.queryByText("today")).not.toBeInTheDocument();
  });

  it("shows 'today' when last data point is from today", () => {
    setup({
      isFetching: false,
      data: [buildUsageHistoryItem({ date: subDays(new Date(), 2), totalUsdSpent: 100 }), buildUsageHistoryItem({ date: new Date(), totalUsdSpent: 150 })],
      field: "totalUsdSpent"
    });

    expect(screen.getByText("Trending up by 50%")).toBeInTheDocument();
    expect(screen.getByText("Graph Up")).toBeInTheDocument();
    expect(screen.getByText("today")).toBeInTheDocument();
  });

  it("does not render when data has less than 2 items", () => {
    setup({
      isFetching: false,
      data: [buildUsageHistoryItem({ date: new Date(), totalUsdSpent: 100 })],
      field: "totalUsdSpent"
    });

    expect(screen.queryByText(/Trending/)).not.toBeInTheDocument();
  });

  it("does not render when first value is 0 (to avoid division by zero)", () => {
    setup({
      isFetching: false,
      data: [buildUsageHistoryItem({ date: subDays(new Date(), 2), totalUsdSpent: 0 }), buildUsageHistoryItem({ date: new Date(), totalUsdSpent: 150 })],
      field: "totalUsdSpent"
    });

    expect(screen.queryByText(/Trending/)).not.toBeInTheDocument();
  });

  it("does not render when change is 0%", () => {
    setup({
      isFetching: false,
      data: [buildUsageHistoryItem({ date: subDays(new Date(), 2), totalUsdSpent: 100 }), buildUsageHistoryItem({ date: new Date(), totalUsdSpent: 100 })],
      field: "totalUsdSpent"
    });

    expect(screen.queryByText(/Trending/)).not.toBeInTheDocument();
  });

  it("does not render when isFetching is true", () => {
    setup({
      isFetching: true,
      data: [buildUsageHistoryItem({ date: subDays(new Date(), 2), totalUsdSpent: 100 }), buildUsageHistoryItem({ date: new Date(), totalUsdSpent: 150 })],
      field: "totalUsdSpent"
    });

    expect(screen.queryByText(/Trending/)).not.toBeInTheDocument();
  });

  it("filters out items with undefined values before comparison", () => {
    setup({
      isFetching: false,
      data: [
        buildUsageHistoryItem({ date: subDays(new Date(), 4), totalUsdSpent: 100 }),
        buildUsageHistoryItem({ date: subDays(new Date(), 2), totalUsdSpent: undefined }),
        buildUsageHistoryItem({ date: subDays(new Date(), 1), totalUsdSpent: 200 })
      ],
      field: "totalUsdSpent"
    });

    expect(screen.getByText("Trending up by 100%")).toBeInTheDocument();
    expect(screen.getByText("Graph Up")).toBeInTheDocument();
  });

  function setup(props: TrendIndicatorProps<"totalUsdSpent", UsageHistory>) {
    const defaultProps: TrendIndicatorProps<"totalUsdSpent", UsageHistory> = {
      components: {
        GraphUp: (() => <span>Graph Up</span>) as unknown as Required<TrendIndicatorProps<"totalUsdSpent", UsageHistory>>["components"]["GraphUp"],
        GraphDown: (() => <span>Graph Down</span>) as unknown as Required<TrendIndicatorProps<"totalUsdSpent", UsageHistory>>["components"]["GraphDown"]
      },
      isFetching: props.isFetching ?? false,
      data: props.data ?? [
        buildUsageHistoryItem({ date: subDays(new Date(), 6), totalUsdSpent: 100 }),
        buildUsageHistoryItem({ date: subDays(new Date(), 5), totalUsdSpent: 150 }),
        buildUsageHistoryItem({ date: subDays(new Date(), 4), totalUsdSpent: 200 }),
        buildUsageHistoryItem({ date: subDays(new Date(), 3), totalUsdSpent: 250 }),
        buildUsageHistoryItem({ date: subDays(new Date(), 2), totalUsdSpent: 300 }),
        buildUsageHistoryItem({ date: subDays(new Date(), 1), totalUsdSpent: 350 }),
        buildUsageHistoryItem({ date: new Date(), totalUsdSpent: 400 })
      ],
      field: "totalUsdSpent"
    };

    render(<TrendIndicator {...defaultProps} />);
  }
});
