import React, { useState } from "react";
import type { Charge } from "@akashnetwork/http-sdk/src/stripe/stripe.types";
import type { PaginationState } from "@tanstack/react-table";
import axios from "axios";

import { useServices } from "@src/context/ServicesProvider";
import { usePaymentTransactionsQuery } from "@src/queries";
import { createDateRange } from "@src/utils/dateUtils";
import { downloadCsv } from "@src/utils/domUtils";

const DEPENDENCIES = {
  usePaymentTransactionsQuery
};

export type ChildrenProps = {
  data: Charge[];
  hasMore: boolean;
  hasPrevious: boolean;
  isFetching: boolean;
  isError: boolean;
  errorMessage: string;
  onExport: () => void;
  onPaginationChange: (state: PaginationState) => void;
  pagination: PaginationState;
  totalCount: number;
  dateRange: { from: Date; to: Date };
  onDateRangeChange: (range: { from: Date; to: Date }) => void;
};

type BillingContainerProps = {
  children: (props: ChildrenProps) => React.ReactNode;
  dependencies?: typeof DEPENDENCIES;
};

type CursorHistoryItem = {
  startingAfter?: string | null;
  endingBefore?: string | null;
  pageIndex: number;
};

export const BillingContainer: React.FC<BillingContainerProps> = ({ children, dependencies: D = DEPENDENCIES }) => {
  const { stripe } = useServices();
  const [dateRange, setDateRange] = React.useState<{ from: Date; to: Date }>(() => createDateRange());
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [currentCursors, setCurrentCursors] = useState<{
    startingAfter?: string | null;
    endingBefore?: string | null;
  }>({});

  const [cursorHistory, setCursorHistory] = useState<CursorHistoryItem[]>([{ pageIndex: 0 }]);

  const [errorMessage, setErrorMessage] = React.useState("");

  const { from: startDate, to: endDate } = dateRange;

  const {
    data,
    isFetching,
    isError,
    error: queryError
  } = D.usePaymentTransactionsQuery({
    limit: pagination.pageSize,
    startingAfter: currentCursors.startingAfter,
    endingBefore: currentCursors.endingBefore,
    startDate,
    endDate
  });

  React.useEffect(() => {
    if (axios.isAxiosError(queryError)) {
      setErrorMessage(queryError.response?.data.message || "An error occurred while fetching payment transactions.");
    }
  }, [queryError]);

  const handlePaginationChange = (state: PaginationState) => {
    const isForward = state.pageIndex > pagination.pageIndex;
    const isBackward = state.pageIndex < pagination.pageIndex;

    if (isForward && data?.nextPage) {
      const newCursors = {
        startingAfter: data.nextPage,
        endingBefore: undefined
      };

      setCurrentCursors(newCursors);

      setCursorHistory(prev => [
        ...prev,
        {
          startingAfter: data.nextPage,
          pageIndex: state.pageIndex
        }
      ]);
    } else if (isBackward) {
      const targetHistoryItem = cursorHistory.find(item => item.pageIndex === state.pageIndex);

      if (targetHistoryItem) {
        setCurrentCursors({
          startingAfter: targetHistoryItem.startingAfter,
          endingBefore: targetHistoryItem.endingBefore
        });

        setCursorHistory(prev => prev.filter(item => item.pageIndex <= state.pageIndex));
      } else if (state.pageIndex === 0) {
        setCurrentCursors({});
        setCursorHistory([{ pageIndex: 0 }]);
      }
    } else if (state.pageSize !== pagination.pageSize) {
      setCurrentCursors({});
      setCursorHistory([{ pageIndex: 0 }]);
      setPagination(prev => ({
        ...prev,
        pageIndex: 0,
        pageSize: state.pageSize
      }));
      return;
    }

    setPagination(state);
  };

  const changeDateRange = (range?: { from?: Date; to?: Date }) => {
    setDateRange(createDateRange(range));
  };

  const exportCsv = async () => {
    if (!startDate || !endDate) {
      return;
    }

    const csv = await stripe.exportTransactionsCsv({
      startDate,
      endDate,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });

    const [dateFrom] = startDate.toISOString().split("T");
    const [dateTo] = endDate.toISOString().split("T");
    const filename = `transactions_${dateFrom}_${dateTo}.csv`;

    downloadCsv(csv, filename);
  };

  return (
    <>
      {children({
        data: data?.transactions || [],
        hasMore: data?.hasMore || false,
        hasPrevious: pagination.pageIndex > 0,
        onExport: exportCsv,
        onPaginationChange: handlePaginationChange,
        totalCount: data?.totalCount || 0,
        dateRange,
        onDateRangeChange: changeDateRange,
        pagination,
        isFetching,
        isError,
        errorMessage
      })}
    </>
  );
};
