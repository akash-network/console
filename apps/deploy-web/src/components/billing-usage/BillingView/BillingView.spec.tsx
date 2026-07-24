import React from "react";
import { TooltipProvider } from "@akashnetwork/ui/components";
import { describe, expect, it, vi } from "vitest";

import type { BillingTransaction } from "@src/queries";
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
    setup({ isError: true, errorMessage: "fail!" });
    expect(screen.getByText("Error fetching billing data")).toBeInTheDocument();
    expect(screen.getByText("fail!")).toBeInTheDocument();
  });

  it("shows empty state when no data", () => {
    setup({ data: [] });
    expect(screen.getByText(/No billing history found/i)).toBeInTheDocument();
  });

  it("renders table headers", () => {
    setup();
    expect(screen.getByText("History")).toBeInTheDocument();
    expect(screen.getByText("Date")).toBeInTheDocument();
    expect(screen.getByText("Type")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByText("Amount")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Receipt")).toBeInTheDocument();
  });

  it("renders the type badge label for each transaction type", () => {
    setup({
      data: [
        createMockTransaction({ type: "payment_intent" }),
        createMockTransaction({ type: "coupon_claim" }),
        createMockTransaction({ type: "manual_credit" })
      ]
    });

    expect(screen.getByText("Card Payment")).toBeInTheDocument();
    expect(screen.getByText("Coupon")).toBeInTheDocument();
    expect(screen.getByText("Manual Credit")).toBeInTheDocument();
  });

  it("shows the card brand and last4 under a card payment", () => {
    setup({ data: [createMockTransaction({ type: "payment_intent", cardBrand: "visa", cardLast4: "4242" })] });

    expect(screen.getByText(/Visa/)).toBeInTheDocument();
    expect(screen.getByText(/4242/)).toBeInTheDocument();
  });

  it("renders the description, falling back to N/A when missing", () => {
    setup({
      data: [createMockTransaction({ description: "Wallet top-up" }), createMockTransaction({ description: null })]
    });

    expect(screen.getByText("Wallet top-up")).toBeInTheDocument();
    expect(screen.getByText("N/A")).toBeInTheDocument();
  });

  it("renders the transaction amount", () => {
    const { data } = setup({ data: [createMockTransaction({ amount: 25000, status: "succeeded" })] });
    expect(screen.getByText((data[0].amount / 100).toFixed(2))).toBeInTheDocument();
  });

  it("shows the first-purchase bonus under the amount when present", () => {
    setup({ data: [createMockTransaction({ amount: 25000, bonusAmount: 1000 })] });

    expect(screen.getByText("250.00")).toBeInTheDocument();
    expect(screen.getByText("10.00")).toBeInTheDocument();
    expect(screen.getByText(/bonus/)).toBeInTheDocument();
  });

  it("renders no bonus line when the transaction has no bonus", () => {
    setup({ data: [createMockTransaction({ amount: 25000, bonusAmount: 0 })] });

    expect(screen.queryByText(/bonus/)).not.toBeInTheDocument();
  });

  it("shows the refunded amount when the transaction has a refund", () => {
    setup({ data: [createMockTransaction({ amount: 25000, amountRefunded: 5000, status: "refunded" })] });

    expect(screen.getByText("50.00")).toBeInTheDocument();
    expect(screen.getByText(/refunded/)).toBeInTheDocument();
    expect(screen.getByText("Refunded")).toBeInTheDocument();
  });

  it("renders no refunded line when nothing was refunded", () => {
    setup({ data: [createMockTransaction({ amount: 25000, amountRefunded: 0 })] });

    expect(screen.queryByText(/refunded/i)).not.toBeInTheDocument();
  });

  it("renders a receipt link when a receipt url is present", () => {
    setup({ data: [createMockTransaction({ receiptUrl: "https://example.com/receipt" })] });
    const receiptLink = screen.getAllByRole("link").find(link => link.getAttribute("target") === "_blank");
    expect(receiptLink).toHaveAttribute("href", "https://example.com/receipt");
  });

  it("renders no receipt link when the receipt url is missing", () => {
    setup({ data: [createMockTransaction({ receiptUrl: null })] });
    const receiptLink = screen.queryAllByRole("link").find(link => link.getAttribute("target") === "_blank");
    expect(receiptLink).toBeUndefined();
  });

  it("calls onPaginationChange when changing page size", () => {
    const onPaginationChange = vi.fn();
    setup({ onPaginationChange });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "20" } });
    expect(onPaginationChange).toHaveBeenCalledWith({ pageIndex: 0, pageSize: 20 });
  });

  it("calls onPaginationChange when clicking next/prev", () => {
    const onPaginationChange = vi.fn();
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
    const onDateRangeChange = vi.fn();
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
    const onDateRangeChange = vi.fn();
    setup({
      onDateRangeChange,
      dateRange: {
        from: new Date("2020-01-01"),
        to: new Date()
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

  it("calls onExport when export button clicked", () => {
    const onExport = vi.fn();
    setup({ onExport });
    fireEvent.click(screen.getByText(/Export as CSV/i));
    expect(onExport).toHaveBeenCalled();
  });

  function setup(props: Partial<React.ComponentProps<typeof BillingView>> = {}) {
    const defaultData: BillingTransaction[] = createMockItems(createMockTransaction, 1);

    const defaultComponents: NonNullable<BillingViewProps["components"]> = {
      FormattedNumber: ({ value }) => <span>{value.toFixed(2)}</span>,
      PaginationSizeSelector: ({ pageSize, setPageSize }) => (
        <select value={pageSize} onChange={e => setPageSize?.(parseInt(e.target.value, 10))} role="combobox">
          {[10, 20, 50].map(size => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      ),
      DateRangePicker: ({ date = props.dateRange, onChange }) => (
        <div>
          <label>
            <span>Filter by start date</span>
            <input
              type="date"
              value={date?.from ? date.from.toISOString().split("T")[0] : ""}
              onChange={e => onChange?.({ from: new Date(e.target.value), to: date?.to || new Date() })}
            />
          </label>
          <label>
            <span>Filter by end date</span>
            <input
              type="date"
              value={date?.to ? date.to.toISOString().split("T")[0] : ""}
              onChange={e => onChange?.({ from: date?.from || new Date(), to: new Date(e.target.value) })}
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
      errorMessage: "",
      onExport: props.onExport ?? vi.fn(),
      onPaginationChange: props.onPaginationChange ?? vi.fn(),
      pagination: props.pagination ?? { pageIndex: 0, pageSize: 10 },
      totalCount: 1,
      dateRange: { from: new Date(), to: new Date() },
      onDateRangeChange: props.onDateRangeChange ?? vi.fn(),
      components: props.components ?? defaultComponents,
      ...props
    };

    render(
      <TooltipProvider>
        <BillingView {...defaultProps} />
      </TooltipProvider>
    );

    return defaultProps;
  }
});
