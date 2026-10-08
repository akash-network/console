import React from "react";
import { describe, expect, it, vi } from "vitest";

import { BillingView, type DEPENDENCIES } from "./BillingView";

import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMockTransaction } from "@tests/seeders/payment";

describe(BillingView.name, () => {
  it("renders the history under the History section", () => {
    setup();

    expect(screen.getByRole("region", { name: "History" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Payment history" })).toBeInTheDocument();
  });

  it("labels the columns", () => {
    setup();

    expect(screen.getAllByRole("columnheader").map(header => header.textContent)).toEqual(["Date", "Amount", "Account source", "Status", "Receipt"]);
  });

  it("shows a skeleton on first load", () => {
    setup({ isLoading: true, data: [] });

    expect(screen.getByTestId("billing-history-skeleton")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows an error alert in place of the table", () => {
    setup({ isError: true, errorMessage: "fail!" });

    expect(screen.getByText("Error fetching billing data")).toBeInTheDocument();
    expect(screen.getByText("fail!")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("falls back to a generic message when the error has none", () => {
    setup({ isError: true, errorMessage: null });

    expect(screen.getByText("An unexpected error occurred.")).toBeInTheDocument();
  });

  it("explains an empty period and keeps the date filter reachable", () => {
    setup({ data: [], totalCount: 0 });

    expect(screen.getByText("No payments in this period")).toBeInTheDocument();
    expect(screen.getByText("Payments, coupons and credits added to your balance show up here.")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Date range" })).toBeInTheDocument();
    expect(screen.queryByTestId("pagination")).not.toBeInTheDocument();
  });

  it("fades the rows while the next page loads", () => {
    setup({ isFetching: true });

    expect(screen.getByRole("table")).toHaveAttribute("aria-busy", "true");
  });

  it("names the card behind a card payment", () => {
    setup({ data: [createMockTransaction({ type: "payment_intent", cardBrand: "visa", cardLast4: "4242" })] });

    expect(cell(0, "Account source")).toHaveTextContent("Visa **** 4242");
  });

  it("leaves the brand out when the card has none", () => {
    setup({ data: [createMockTransaction({ cardBrand: null, cardLast4: "4242" })] });

    expect(cell(0, "Account source")).toHaveTextContent(/^\*\*\*\* 4242$/);
  });

  it.each([
    { type: "coupon_claim" as const, label: "Coupon" },
    { type: "manual_credit" as const, label: "Manual credit" },
    { type: "payment_intent" as const, label: "Card payment" },
    { type: "affiliate_commission" as const, label: "Affiliate commission" }
  ])("names a $type without a card as $label with its description", ({ type, label }) => {
    setup({ data: [createMockTransaction({ type, cardLast4: null, description: "Hackathon credits" })] });

    expect(cell(0, "Account source")).toHaveTextContent(`${label}Hackathon credits`);
  });

  it("omits the description line when a credit has none", () => {
    setup({ data: [createMockTransaction({ type: "coupon_claim", cardLast4: null, description: null })] });

    expect(cell(0, "Account source")).toHaveTextContent(/^Coupon$/);
  });

  it.each(["coupon_claim" as const, "manual_credit" as const, "affiliate_commission" as const])("reads a %s as money in", type => {
    setup({ data: [createMockTransaction({ type, amount: 2500, cardLast4: null })] });

    const amount = within(cell(0, "Amount")).getByText(/25\.00/);
    expect(amount).toHaveTextContent("+25.00");
    expect(amount).toHaveAttribute("data-credit", "true");
  });

  it("shows card payments without a sign", () => {
    setup({ data: [createMockTransaction({ type: "payment_intent", amount: 2500 })] });

    expect(cell(0, "Amount")).toHaveTextContent(/^25\.00$/);
    expect(within(cell(0, "Amount")).getByText("25.00")).not.toHaveAttribute("data-credit");
  });

  it("shows the first-purchase bonus under the amount", () => {
    setup({ data: [createMockTransaction({ amount: 25000, bonusAmount: 1000 })] });

    expect(cell(0, "Amount")).toHaveTextContent("250.00+10.00 bonus");
  });

  it("shows the refunded part under the amount", () => {
    setup({ data: [createMockTransaction({ amount: 25000, amountRefunded: 5000, status: "refunded" })] });

    expect(cell(0, "Amount")).toHaveTextContent("250.00-50.00 refunded");
    expect(cell(0, "Status")).toHaveTextContent("Refunded");
  });

  it("adds no bonus or refund line when there is neither", () => {
    setup({ data: [createMockTransaction({ amount: 25000, bonusAmount: 0, amountRefunded: 0 })] });

    expect(cell(0, "Amount")).toHaveTextContent(/^250\.00$/);
  });

  it.each([
    { status: "succeeded", label: "Successful" },
    { status: "pending", label: "Pending" },
    { status: "failed", label: "Failed" },
    { status: "requires_action", label: "Requires_action" }
  ])("labels a $status payment as $label", ({ status, label }) => {
    setup({ data: [createMockTransaction({ status })] });

    const pill = within(cell(0, "Status")).getByText(label);
    expect(pill).toHaveAttribute("data-status", status);
  });

  it("labels a fully reversed affiliate commission as Reversed rather than Refunded", () => {
    setup({ data: [createMockTransaction({ type: "affiliate_commission", status: "refunded", cardLast4: null })] });

    const pill = within(cell(0, "Status")).getByText("Reversed");
    expect(pill).toHaveAttribute("data-status", "refunded");
    expect(within(cell(0, "Status")).queryByText("Refunded")).not.toBeInTheDocument();
  });

  it("labels a partially reversed affiliate commission as Successful", () => {
    setup({ data: [createMockTransaction({ type: "affiliate_commission", status: "succeeded", amountRefunded: 100, cardLast4: null })] });

    expect(cell(0, "Status")).toHaveTextContent(/^Successful$/);
  });

  it("labels a refunded card payment as Refunded", () => {
    setup({ data: [createMockTransaction({ type: "payment_intent", status: "refunded" })] });

    expect(cell(0, "Status")).toHaveTextContent(/^Refunded$/);
  });

  it("links to the receipt in a new tab", () => {
    setup({ data: [createMockTransaction({ receiptUrl: "https://example.com/receipt" })] });

    const receipt = screen.getByRole("link", { name: "View receipt" });
    expect(receipt).toHaveAttribute("href", "https://example.com/receipt");
    expect(receipt).toHaveAttribute("target", "_blank");
    expect(receipt).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders no receipt link when the receipt url is missing", () => {
    setup({ data: [createMockTransaction({ receiptUrl: null })] });

    expect(screen.queryByRole("link", { name: "View receipt" })).not.toBeInTheDocument();
  });

  it("renders the transaction date", () => {
    const created = new Date(2026, 8, 30, 12);
    setup({ data: [createMockTransaction({ created: created.getTime() / 1000 })] });

    expect(cell(0, "Date")).toHaveTextContent(created.toLocaleDateString());
  });

  it("derives one page per pageSize chunk of totalCount", () => {
    const { CustomPagination } = setup({ totalCount: 35, pagination: { pageIndex: 1, pageSize: 10 } });

    expect(CustomPagination).toHaveBeenLastCalledWith(expect.objectContaining({ totalPageCount: 4, pageIndex: 1, pageSize: 10 }), expect.anything());
  });

  it("moves to the page the pager asks for", () => {
    const { CustomPagination, onPaginationChange } = setup({ totalCount: 35, pagination: { pageIndex: 0, pageSize: 10 } });

    CustomPagination.mock.lastCall![0].setPageIndex(2);

    expect(onPaginationChange).toHaveBeenCalledWith({ pageIndex: 2, pageSize: 10 });
  });

  it("returns to the first page when the page size changes", () => {
    const { CustomPagination, onPaginationChange } = setup({ totalCount: 35, pagination: { pageIndex: 2, pageSize: 10 } });

    CustomPagination.mock.lastCall![0].setPageSize(20);

    expect(onPaginationChange).toHaveBeenCalledWith({ pageIndex: 0, pageSize: 20 });
  });

  it("shows the selected date preset", () => {
    setup({ datePreset: "last3Months" });

    expect(screen.getByRole("combobox", { name: "Date range" })).toHaveTextContent("Last 3 months");
  });

  it("switches to the date preset picked from the menu", async () => {
    const { onDatePresetChange } = setup({ datePreset: "last3Months" });

    await userEvent.click(screen.getByRole("combobox", { name: "Date range" }));
    await userEvent.click(screen.getByRole("option", { name: "Last 12 months" }));

    expect(onDatePresetChange).toHaveBeenCalledWith("last12Months");
  });

  it("offers the custom range picker only for a custom range", () => {
    const { DateRangePicker } = setup({ datePreset: "last30Days" });

    expect(DateRangePicker).not.toHaveBeenCalled();
  });

  it("passes the current range and its limits to the custom range picker", () => {
    const dateRange = { from: new Date(2026, 6, 1), to: new Date(2026, 6, 31) };
    const { DateRangePicker, onDateRangeChange } = setup({ datePreset: "custom", dateRange });

    const props = DateRangePicker.mock.lastCall![0];
    props.onChange!({ from: new Date(2026, 5, 1), to: new Date(2026, 5, 30) });

    expect(props).toEqual(expect.objectContaining({ date: dateRange, maxRangeInDays: 366 }));
    expect(props.minDate!.getTime()).toBeLessThan(props.maxDate!.getTime());
    expect(onDateRangeChange).toHaveBeenCalledWith({ from: new Date(2026, 5, 1), to: new Date(2026, 5, 30) });
  });

  it("exports the history as CSV", () => {
    const { onExport } = setup();

    fireEvent.click(screen.getByRole("button", { name: "Export as CSV" }));

    expect(onExport).toHaveBeenCalled();
  });

  it("disables the export when the period has no payments", () => {
    setup({ data: [], totalCount: 0 });

    expect(screen.getByRole("button", { name: "Export as CSV" })).toBeDisabled();
  });

  function cell(rowIndex: number, column: string) {
    const columnIndex = ["Date", "Amount", "Account source", "Status", "Receipt"].indexOf(column);
    const rows = screen.getAllByRole("row").slice(1);
    return within(rows[rowIndex]).getAllByRole("cell")[columnIndex];
  }

  function setup(input: Partial<Omit<React.ComponentProps<typeof BillingView>, "dependencies">> = {}) {
    const CustomPagination = vi.fn<typeof DEPENDENCIES.CustomPagination>(() => <div data-testid="pagination" />);
    const DateRangePicker = vi.fn<typeof DEPENDENCIES.DateRangePicker>(() => <div />);
    const FormattedNumber = vi.fn((({ value }: { value: number }) => <>{value.toFixed(2)}</>) as typeof DEPENDENCIES.FormattedNumber);

    const props: React.ComponentProps<typeof BillingView> = {
      data: [createMockTransaction()],
      isLoading: false,
      isFetching: false,
      isError: false,
      errorMessage: "",
      onExport: vi.fn(),
      onPaginationChange: vi.fn(),
      pagination: { pageIndex: 0, pageSize: 10 },
      totalCount: 1,
      dateRange: { from: new Date(2026, 6, 2), to: new Date(2026, 9, 2) },
      onDateRangeChange: vi.fn(),
      datePreset: "last3Months",
      onDatePresetChange: vi.fn(),
      ...input,
      dependencies: { CustomPagination, DateRangePicker, FormattedNumber }
    };

    render(<BillingView {...props} />);

    return { ...props, CustomPagination, DateRangePicker };
  }
});
