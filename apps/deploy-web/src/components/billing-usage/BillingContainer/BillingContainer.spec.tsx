import "@testing-library/jest-dom";

import React from "react";
import type { Charge } from "@akashnetwork/http-sdk/src/stripe/stripe.types";
import type { PaginationState } from "@tanstack/react-table";
import type { AxiosError } from "axios";
import { mock } from "jest-mock-extended";

import type { usePaymentTransactionsQuery } from "@src/queries";
import type { ChildrenProps } from "./BillingContainer";
import { BillingContainer } from "./BillingContainer";

import { render } from "@testing-library/react";
import { createMockTransaction } from "@tests/seeders/payment";
import { createContainerTestingChildCapturer } from "@tests/unit/container-testing-child-capturer";

describe(BillingContainer.name, () => {
  it("renders payment transactions data", async () => {
    const { data, child } = await setup();
    expect(child.data).toEqual(data?.transactions);
    expect(child.totalCount).toBe(data?.totalCount);
    expect(child.hasMore).toBe(data?.hasMore);
    expect(child.hasPrevious).toBe(false);
  });

  it("passes through loading and error flags", async () => {
    const { child } = await setup({ isFetching: true, isError: true });
    expect(child.isFetching).toBe(true);
    expect(child.isError).toBe(true);
  });

  it("passes error object if queryError is axios error", async () => {
    const axiosError = mock<AxiosError>({
      isAxiosError: true,
      response: { data: { message: "fail" } }
    });
    const { child } = await setup({ queryError: axiosError });
    expect(child.errorMessage).toBe("fail");
  });

  it("uses default values when data is empty", async () => {
    const { child } = await setup({ data: undefined });
    expect(child.data).toEqual([]);
    expect(child.totalCount).toBe(0);
    expect(child.hasMore).toBe(false);
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

  async function setup(
    overrides: Partial<{
      data: { transactions: Charge[]; hasMore: boolean; nextPage?: string; totalCount: number };
      isFetching: boolean;
      isError: boolean;
      queryError: AxiosError;
    }> = {}
  ) {
    const useDefaultData = !Object.prototype.hasOwnProperty.call(overrides, "data");
    const data = useDefaultData
      ? {
          transactions: [createMockTransaction()],
          hasMore: true,
          nextPage: "next_cursor",
          totalCount: 1
        }
      : overrides.data;

    const isFetching = overrides.isFetching ?? false;
    const isError = overrides.isError ?? false;
    const queryError = overrides.queryError ?? null;

    const onPaginationChange = jest.fn();
    const onDateRangeChange = jest.fn();
    const onExport = jest.fn();

    const mockedUsePaymentTransactionsQuery = jest.fn(() => ({
      data,
      isFetching,
      isError,
      error: queryError
    })) as unknown as jest.MockedFunction<typeof usePaymentTransactionsQuery>;

    const dependencies = {
      usePaymentTransactionsQuery: mockedUsePaymentTransactionsQuery
    };

    const childCapturer = createContainerTestingChildCapturer<ChildrenProps>();

    render(
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
              props.onExport();
            }
          });
        }}
      </BillingContainer>
    );

    const child = await childCapturer.awaitChild(() => true);

    return { data, child, onPaginationChange, onDateRangeChange, onExport };
  }
});
