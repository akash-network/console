import "@testing-library/jest-dom";

import React from "react";
import { startOfWeek, subDays, subMonths } from "date-fns";

import type { TrendIndicatorProps } from "@src/components/billing-usage/TrendIndicator/TrendIndicator";
import { TrendIndicator } from "@src/components/billing-usage/TrendIndicator/TrendIndicator";
import type { UsageHistory } from "@src/types";

import { render, screen } from "@testing-library/react";
import { buildUsageHistoryItem } from "@tests/seeders/usage";

describe("TrendIndicator", () => {
  it("renders increased trend indicator for daily period with current day included", () => {
    setup({
      isFetching: false,
      data: [
        buildUsageHistoryItem({ date: subDays(new Date(), 2).toISOString().split("T")[0], totalUsdSpent: 100 }),
        buildUsageHistoryItem({ date: new Date().toISOString().split("T")[0], totalUsdSpent: 150 })
      ],
      field: "totalUsdSpent"
    });

    expect(screen.getByText("Trending up by 50%")).toBeInTheDocument();
    expect(screen.getByText("Graph Up")).toBeInTheDocument();
    expect(screen.queryByText("Graph Down")).not.toBeInTheDocument();
    expect(screen.getByText("today")).toBeInTheDocument();
  });

  it("renders decreased trend indicator for daily period without current day included", () => {
    setup({
      isFetching: false,
      data: [
        buildUsageHistoryItem({ date: subDays(new Date(), 2).toISOString().split("T")[0], totalUsdSpent: 300 }),
        buildUsageHistoryItem({ date: subDays(new Date(), 1).toISOString().split("T")[0], totalUsdSpent: 100 })
      ],
      field: "totalUsdSpent"
    });

    expect(screen.getByText("Trending down by 66.67%")).toBeInTheDocument();
    expect(screen.queryByText("Graph Up")).not.toBeInTheDocument();
    expect(screen.getByText("Graph Down")).toBeInTheDocument();
    expect(screen.queryByText("today")).not.toBeInTheDocument();
  });

  it("renders increased trend indicator for weekly period with current week included", () => {
    setup({
      isFetching: false,
      data: [
        buildUsageHistoryItem({ date: startOfWeek(subDays(new Date(), 14)).toISOString().split("T")[0], totalUsdSpent: 50 }),
        buildUsageHistoryItem({ date: startOfWeek(subDays(new Date(), 7)).toISOString().split("T")[0], totalUsdSpent: 100 }),
        buildUsageHistoryItem({ date: startOfWeek(new Date()).toISOString().split("T")[0], totalUsdSpent: 200 })
      ],
      field: "totalUsdSpent"
    });

    expect(screen.getByText("Trending up by 100%")).toBeInTheDocument();
    expect(screen.getByText("Graph Up")).toBeInTheDocument();
    expect(screen.queryByText("Graph Down")).not.toBeInTheDocument();
    expect(screen.getByText("this week")).toBeInTheDocument();
  });

  it("renders decreased trend indicator for weekly period without current week included", () => {
    setup({
      isFetching: false,
      data: [
        buildUsageHistoryItem({ date: startOfWeek(subDays(new Date(), 14)).toISOString().split("T")[0], totalUsdSpent: 50 }),
        buildUsageHistoryItem({ date: startOfWeek(subDays(new Date(), 7)).toISOString().split("T")[0], totalUsdSpent: 300 }),
        buildUsageHistoryItem({ date: startOfWeek(subDays(new Date(), 7)).toISOString().split("T")[0], totalUsdSpent: 100 })
      ],
      field: "totalUsdSpent"
    });

    expect(screen.getByText("Trending down by 66.67%")).toBeInTheDocument();
    expect(screen.queryByText("Graph Up")).not.toBeInTheDocument();
    expect(screen.getByText("Graph Down")).toBeInTheDocument();
    expect(screen.queryByText("this week")).not.toBeInTheDocument();
  });

  it("renders increased trend indicator for monthly period with current month included", () => {
    setup({
      isFetching: false,
      data: [
        buildUsageHistoryItem({ date: subDays(new Date(), 45).toISOString().split("T")[0], totalUsdSpent: 15 }),
        buildUsageHistoryItem({ date: subDays(new Date(), 30).toISOString().split("T")[0], totalUsdSpent: 100 }),
        buildUsageHistoryItem({ date: subDays(new Date(), 15).toISOString().split("T")[0], totalUsdSpent: 200 }),
        buildUsageHistoryItem({ date: new Date().toISOString().split("T")[0], totalUsdSpent: 400 })
      ],
      field: "totalUsdSpent"
    });

    expect(screen.getByText("Trending up by 421.74%")).toBeInTheDocument();
    expect(screen.getByText("Graph Up")).toBeInTheDocument();
    expect(screen.queryByText("Graph Down")).not.toBeInTheDocument();
    expect(screen.getByText("this month")).toBeInTheDocument();
  });

  it("renders decreased trend indicator for monthly period without current month included", () => {
    setup({
      isFetching: false,
      data: [
        buildUsageHistoryItem({ date: subMonths(new Date(), 4).toISOString().split("T")[0], totalUsdSpent: 400 }),
        buildUsageHistoryItem({ date: subMonths(new Date(), 3).toISOString().split("T")[0], totalUsdSpent: 300 }),
        buildUsageHistoryItem({ date: subMonths(new Date(), 2).toISOString().split("T")[0], totalUsdSpent: 200 }),
        buildUsageHistoryItem({ date: subMonths(new Date(), 1).toISOString().split("T")[0], totalUsdSpent: 100 })
      ],
      field: "totalUsdSpent"
    });

    expect(screen.getByText("Trending down by 50%")).toBeInTheDocument();
    expect(screen.queryByText("Graph Up")).not.toBeInTheDocument();
    expect(screen.getByText("Graph Down")).toBeInTheDocument();
    expect(screen.queryByText("this month")).not.toBeInTheDocument();
  });

  function setup(props: TrendIndicatorProps<"totalUsdSpent", UsageHistory>) {
    const defaultProps: TrendIndicatorProps<"totalUsdSpent", UsageHistory> = {
      components: {
        GraphUp: () => <div>Graph Up</div>,
        GraphDown: () => <div>Graph Down</div>
      },
      isFetching: props.isFetching ?? false,
      data: props.data ?? [
        buildUsageHistoryItem({ date: subDays(new Date(), 6).toISOString().split("T")[0], totalUsdSpent: 100 }),
        buildUsageHistoryItem({ date: subDays(new Date(), 5).toISOString().split("T")[0], totalUsdSpent: 150 }),
        buildUsageHistoryItem({ date: subDays(new Date(), 4).toISOString().split("T")[0], totalUsdSpent: 200 }),
        buildUsageHistoryItem({ date: subDays(new Date(), 3).toISOString().split("T")[0], totalUsdSpent: 250 }),
        buildUsageHistoryItem({ date: subDays(new Date(), 2).toISOString().split("T")[0], totalUsdSpent: 300 }),
        buildUsageHistoryItem({ date: subDays(new Date(), 1).toISOString().split("T")[0], totalUsdSpent: 350 }),
        buildUsageHistoryItem({ date: new Date().toISOString().split("T")[0], totalUsdSpent: 400 })
      ],
      field: "totalUsdSpent"
    };

    render(<TrendIndicator {...defaultProps} />);
  }
});
