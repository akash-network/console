import "@testing-library/jest-dom";

import React from "react";
import type { Charge } from "@akashnetwork/http-sdk/src/stripe/stripe.types";
import { mock } from "jest-mock-extended";

import type { BillingViewProps } from "./BillingView";
import { BillingView } from "./BillingView";

import { fireEvent, render, screen } from "@testing-library/react";
import { createMockItems, createMockTransaction } from "@tests/seeders/payment";

describe(BillingView.name, () => {
  it("shows spinner when fetching", () => {
    setup({ isFetching: true });
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows error alert when error", () => {
    setup({ isError: true, error: new Error("fail!") });
    expect(screen.getByText("Error fetching billing data")).toBeInTheDocument();
    expect(screen.getByText("fail!")).toBeInTheDocument();
  });

  it("shows empty state when no data", () => {
    setup({ data: [] });
    expect(screen.getByText(/No billing history found/i)).toBeInTheDocument();
  });

  it("renders table with billing data", () => {
    const { data } = setup();
    expect(screen.getByText("History")).toBeInTheDocument();
    expect(screen.getByText("Date")).toBeInTheDocument();
    expect(screen.getByText("Amount")).toBeInTheDocument();
    expect(screen.getByText("Account source")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Receipt")).toBeInTheDocument();

    expect(screen.getByText(new Date(data[0].created * 1000).toLocaleDateString())).toBeInTheDocument();
    expect(screen.getByText((data[0].amount / 100).toFixed(2))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(data[0].paymentMethod.card?.last4 || ""))).toBeInTheDocument();
    expect(screen.getByText(/Succeeded|Pending|Failed/i)).toBeInTheDocument();
  });

  it("calls onPaginationChange when changing page size", () => {
    const onPaginationChange = jest.fn();
    setup({ onPaginationChange });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "20" } });
    expect(onPaginationChange).toHaveBeenCalledWith({ pageIndex: 0, pageSize: 20 });
  });

  it("calls onPaginationChange when clicking next/prev", () => {
    const onPaginationChange = jest.fn();
    setup({ onPaginationChange, hasMore: true, hasPrevious: true, pagination: { pageIndex: 1, pageSize: 10 } });
    fireEvent.click(screen.getByText("Previous"));
    expect(onPaginationChange).toHaveBeenCalledWith({ pageIndex: 0, pageSize: 10 });
    fireEvent.click(screen.getByText("Next"));
    expect(onPaginationChange).toHaveBeenCalledWith({ pageIndex: 2, pageSize: 10 });
  });

  it("disables export button when no data", () => {
    setup({ data: [] });
    expect(screen.getByText(/Export as CSV/i)).toBeDisabled();
  });

  it("enables export button when data exists", () => {
    setup();
    expect(screen.getByText(/Export as CSV/i)).not.toBeDisabled();
  });

  it("calls onDateRangeChange when date range start changes", () => {
    const onDateRangeChange = jest.fn();
    setup({
      onDateRangeChange,
      dateRange: {
        from: new Date(),
        to: new Date("2030-01-01")
      }
    });
    fireEvent.change(screen.getByLabelText("Filter by start date"), {
      target: { value: "2025-01-01" }
    });
    expect(onDateRangeChange).toHaveBeenCalledWith({
      from: new Date("2025-01-01"),
      to: new Date("2030-01-01")
    });
  });

  it("calls onDateRangeChange when date range end changes", () => {
    const onDateRangeChange = jest.fn();
    setup({
      onDateRangeChange,
      dateRange: {
        from: new Date("2020-01-01")
      }
    });
    fireEvent.change(screen.getByLabelText("Filter by end date"), {
      target: { value: "2025-01-01" }
    });
    expect(onDateRangeChange).toHaveBeenCalledWith({
      from: new Date("2020-01-01"),
      to: new Date("2025-01-01")
    });
  });

  function setup(props: Partial<React.ComponentProps<typeof BillingView>> = {}) {
    const defaultData = createMockItems(createMockTransaction, 1).map((t: ReturnType<typeof createMockTransaction>) =>
      mock<Charge>({
        ...t,
        paymentMethod: t.payment_method,
        receiptUrl: "https://example.com/receipt"
      })
    );

    const defaultComponents: NonNullable<BillingViewProps["components"]> = {
      FormattedNumber: ({ value }: { value: number }) => <span>{value}</span>,
      DateRangePicker: ({ date = props.dateRange, onChange }) => (
        <div>
          <label>
            <span>Filter by start date</span>
            <input
              type="date"
              value={date?.from ? date.from.toISOString().split("T")[0] : ""}
              onChange={e => onChange?.({ from: new Date(e.target.value), to: date?.to })}
            />
          </label>
          <label>
            <span>Filter by end date</span>
            <input
              type="date"
              value={date?.to ? date.to.toISOString().split("T")[0] : ""}
              onChange={e => onChange?.({ from: date?.from, to: new Date(e.target.value) })}
            />
          </label>
        </div>
      )
    };

    const defaultProps: React.ComponentProps<typeof BillingView> = {
      data: props.data ?? defaultData,
      hasMore: false,
      hasPrevious: false,
      isFetching: false,
      isError: false,
      error: null,
      onPaginationChange: props.onPaginationChange ?? jest.fn(),
      pagination: props.pagination ?? { pageIndex: 0, pageSize: 10 },
      totalCount: 1,
      dateRange: { from: new Date(), to: new Date() },
      onDateRangeChange: props.onDateRangeChange ?? jest.fn(),
      components: props.components ?? defaultComponents,
      ...props
    };

    render(<BillingView {...defaultProps} />);
    return defaultProps;
  }
});
