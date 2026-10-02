import React from "react";
import type { StripeService } from "@akashnetwork/http-sdk";
import { ApiError } from "@akashnetwork/openapi-sdk";
import type { PaginationState } from "@tanstack/react-table";
import { endOfDay, endOfToday, startOfDay, startOfToday, subDays, subMonths } from "date-fns";
import { describe, expect, it, type MockedFunction, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BillingTransaction, usePaymentTransactionsQuery } from "@src/queries";
import type { ChildrenProps } from "./BillingContainer";
import { BillingContainer } from "./BillingContainer";

import { act, render } from "@testing-library/react";
import { createMockTransaction } from "@tests/seeders/payment";
import { createContainerTestingChildCapturer } from "@tests/unit/container-testing-child-capturer";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

describe(BillingContainer.name, () => {
  it("renders payment transactions data", async () => {
    const { data, child } = await setup();
    expect(child.data).toEqual(data?.transactions);
    expect(child.totalCount).toBe(data?.totalCount);
  });

  it("passes through loading and error flags", async () => {
    const { child } = await setup({ isFetching: true, isError: true });
    expect(child.isFetching).toBe(true);
    expect(child.isError).toBe(true);
  });

  it("surfaces the API error message when the query fails", async () => {
    const apiError = new ApiError(500, { message: "fail" }, "GET /v1/stripe/transactions → 500");
    const { child } = await setup({ queryError: apiError });
    expect(child.errorMessage).toBe("fail");
  });

  it("uses default values when data is empty", async () => {
    const { child } = await setup({ data: undefined });
    expect(child.data).toEqual([]);
    expect(child.totalCount).toBe(0);
  });

  it("calls onPaginationChange", async () => {
    const { child, onPaginationChange } = await setup();
    const newPagination: PaginationState = { pageIndex: 1, pageSize: 10 };
    child.onPaginationChange(newPagination);
    expect(onPaginationChange).toHaveBeenCalledWith(newPagination);
  });

  it("calls onDateRangeChange", async () => {
    const { child, onDateRangeChange } = await setup();
    const newRange = { from: new Date(2024, 0, 1), to: new Date(2024, 0, 2) };
    child.onDateRangeChange(newRange);
    expect(onDateRangeChange).toHaveBeenCalledWith(newRange);
  });

  it("calls onExport", async () => {
    const { child, onExport } = await setup();
    child.onExport();
    expect(onExport).toHaveBeenCalled();
  });

  it("starts on the last 3 months", async () => {
    const { child, mockedUsePaymentTransactionsQuery } = await setup();

    expect(child.datePreset).toBe("last3Months");
    expect(child.dateRange).toEqual({ from: subMonths(startOfToday(), 3), to: endOfToday() });
    expect(mockedUsePaymentTransactionsQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ startDate: subMonths(startOfToday(), 3), endDate: endOfToday() })
    );
  });

  it("loads a preset's range from the first page", async () => {
    const { child, childCapturer, mockedUsePaymentTransactionsQuery } = await setup();

    act(() => child.onPaginationChange({ pageIndex: 2, pageSize: 10 }));
    act(() => child.onDatePresetChange("last30Days"));
    const next = await childCapturer.awaitChild(candidate => candidate.datePreset === "last30Days");

    expect(next.dateRange).toEqual({ from: subDays(startOfToday(), 29), to: endOfToday() });
    expect(next.pagination.pageIndex).toBe(0);
    expect(mockedUsePaymentTransactionsQuery).toHaveBeenLastCalledWith(expect.objectContaining({ startDate: subDays(startOfToday(), 29), offset: 0 }));
  });

  it("keeps the current range and page when switching to a custom range", async () => {
    const { child, childCapturer } = await setup();

    act(() => child.onDatePresetChange("last30Days"));
    const last30Days = await childCapturer.awaitChild(candidate => candidate.datePreset === "last30Days");
    act(() => last30Days.onPaginationChange({ pageIndex: 2, pageSize: 10 }));
    const onPageThree = await childCapturer.awaitChild(candidate => candidate.pagination.pageIndex === 2);
    act(() => onPageThree.onDatePresetChange("custom"));
    const next = await childCapturer.awaitChild(candidate => candidate.datePreset === "custom");

    expect(next.dateRange).toEqual({ from: subDays(startOfToday(), 29), to: endOfToday() });
    expect(next.pagination.pageIndex).toBe(2);
  });

  it("switches to a custom range and its first page when a range is picked", async () => {
    const { child, childCapturer, mockedUsePaymentTransactionsQuery } = await setup();

    act(() => child.onPaginationChange({ pageIndex: 2, pageSize: 10 }));
    act(() => child.onDateRangeChange({ from: new Date(2024, 0, 1), to: new Date(2024, 0, 2) }));
    const next = await childCapturer.awaitChild(candidate => candidate.datePreset === "custom");

    expect(next.dateRange).toEqual({ from: new Date(2024, 0, 1), to: endOfDay(new Date(2024, 0, 2)) });
    expect(next.pagination.pageIndex).toBe(0);
    expect(mockedUsePaymentTransactionsQuery).toHaveBeenLastCalledWith(expect.objectContaining({ startDate: new Date(2024, 0, 1), offset: 0 }));
  });

  it("moves a preset's range to the current day when the page renders again the next day", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date(2026, 9, 1, 12));
      const { child, childCapturer, mockedUsePaymentTransactionsQuery } = await setup();

      vi.setSystemTime(new Date(2026, 9, 2, 9));
      act(() => child.onPaginationChange({ pageIndex: 1, pageSize: 10 }));
      await childCapturer.awaitChild(candidate => candidate.pagination.pageIndex === 1);

      expect(mockedUsePaymentTransactionsQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ startDate: subMonths(new Date(2026, 9, 2), 3), endDate: endOfDay(new Date(2026, 9, 2)) })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("exports the selected range as CSV", async () => {
    const stripe = mock<StripeService>({ exportTransactionsCsv: vi.fn().mockResolvedValue(new Blob(["csv"])) });
    const clickDownloadLink = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    try {
      const { child } = await setup({ services: { stripe: () => stripe } });

      await act(() => child.onExport());

      expect(stripe.exportTransactionsCsv).toHaveBeenCalledWith(
        expect.objectContaining({ startDate: subMonths(startOfToday(), 3), endDate: endOfToday(), timezone: expect.any(String) })
      );
      expect(clickDownloadLink).toHaveBeenCalledTimes(1);
    } finally {
      clickDownloadLink.mockRestore();
    }
  });

  it("exports a preset's range as of the day the export runs", async () => {
    const stripe = mock<StripeService>({ exportTransactionsCsv: vi.fn().mockResolvedValue(new Blob(["csv"])) });
    const clickDownloadLink = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date(2026, 9, 1, 12));
      const { child } = await setup({ services: { stripe: () => stripe } });

      vi.setSystemTime(new Date(2026, 9, 2, 9));
      await act(() => child.onExport());

      expect(stripe.exportTransactionsCsv).toHaveBeenCalledWith(
        expect.objectContaining({ startDate: subMonths(startOfDay(new Date(2026, 9, 2)), 3), endDate: endOfDay(new Date(2026, 9, 2)) })
      );
    } finally {
      vi.useRealTimers();
      clickDownloadLink.mockRestore();
    }
  });

  async function setup(
    overrides: Partial<{
      data: { transactions: BillingTransaction[]; hasMore: boolean; totalCount: number };
      isLoading: boolean;
      isFetching: boolean;
      isError: boolean;
      queryError: Error;
      services: React.ComponentProps<typeof TestContainerProvider>["services"];
    }> = {}
  ) {
    const useDefaultData = !Object.prototype.hasOwnProperty.call(overrides, "data");
    const data = useDefaultData
      ? {
          transactions: [createMockTransaction()],
          hasMore: true,
          totalCount: 1
        }
      : overrides.data;

    const isLoading = overrides.isLoading ?? false;
    const isFetching = overrides.isFetching ?? false;
    const isError = overrides.isError ?? false;
    const queryError = overrides.queryError ?? null;

    const onPaginationChange = vi.fn();
    const onDateRangeChange = vi.fn();
    const onExport = vi.fn();

    const mockedUsePaymentTransactionsQuery = vi.fn(() => ({
      data,
      isLoading,
      isFetching,
      isError,
      error: queryError
    })) as unknown as MockedFunction<typeof usePaymentTransactionsQuery>;

    const dependencies = {
      usePaymentTransactionsQuery: mockedUsePaymentTransactionsQuery
    };

    const childCapturer = createContainerTestingChildCapturer<ChildrenProps>();

    render(
      <TestContainerProvider services={overrides.services}>
        <BillingContainer dependencies={dependencies}>
          {props => {
            return childCapturer.renderChild({
              ...props,
              onPaginationChange: (state: PaginationState) => {
                onPaginationChange(state);
                props.onPaginationChange(state);
              },
              onDateRangeChange: (range: { from: Date; to: Date }) => {
                onDateRangeChange(range);
                props.onDateRangeChange(range);
              },
              onExport: () => {
                onExport();
                return props.onExport();
              }
            });
          }}
        </BillingContainer>
      </TestContainerProvider>
    );

    const child = await childCapturer.awaitChild(() => true);

    return { data, child, childCapturer, mockedUsePaymentTransactionsQuery, onPaginationChange, onDateRangeChange, onExport };
  }
});
