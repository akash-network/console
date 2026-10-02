import React, { useState } from "react";
import { ApiError, extractApiErrorMessage } from "@akashnetwork/openapi-sdk";
import { useToast } from "@akashnetwork/ui/hooks";
import type { PaginationState } from "@tanstack/react-table";
import axios from "axios";

import { useServices } from "@src/context/ServicesProvider";
import type { BillingTransaction } from "@src/queries";
import { usePaymentTransactionsQuery } from "@src/queries";
import { createDateRange } from "@src/utils/dateUtils";
import { downloadCsv } from "@src/utils/domUtils";
import { DEFAULT_HISTORY_DATE_PRESET, getHistoryPresetRange, type HistoryDatePreset, type HistoryDateRange } from "./historyDatePresets";

const DEPENDENCIES = {
  usePaymentTransactionsQuery
};

export type ChildrenProps = {
  data: BillingTransaction[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  errorMessage: string;
  onExport: () => void;
  onPaginationChange: (state: PaginationState) => void;
  pagination: PaginationState;
  totalCount: number;
  dateRange: HistoryDateRange;
  onDateRangeChange: (range: HistoryDateRange) => void;
  datePreset: HistoryDatePreset;
  onDatePresetChange: (preset: HistoryDatePreset) => void;
};

type BillingContainerProps = {
  children: (props: ChildrenProps) => React.ReactNode;
  dependencies?: typeof DEPENDENCIES;
};

export const BillingContainer: React.FC<BillingContainerProps> = ({ children, dependencies: D = DEPENDENCIES }) => {
  const { toast } = useToast();
  const { stripe } = useServices();
  const [datePreset, setDatePreset] = useState<HistoryDatePreset>(DEFAULT_HISTORY_DATE_PRESET);
  const [customRange, setCustomRange] = useState<HistoryDateRange>(() => getHistoryPresetRange(DEFAULT_HISTORY_DATE_PRESET));
  const dateRange = resolveDateRange(datePreset, customRange);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });

  const [errorMessage, setErrorMessage] = React.useState("");

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error: queryError
  } = D.usePaymentTransactionsQuery({
    limit: pagination.pageSize,
    offset: pagination.pageIndex * pagination.pageSize,
    startDate: dateRange.from,
    endDate: dateRange.to
  });

  React.useEffect(() => {
    if (queryError instanceof ApiError) {
      setErrorMessage(extractApiErrorMessage(queryError) || "An error occurred while fetching payment transactions.");
    }
  }, [queryError]);

  const handlePaginationChange = (state: PaginationState) => {
    setPagination(state.pageSize !== pagination.pageSize ? { pageIndex: 0, pageSize: state.pageSize } : state);
  };

  const restartFromFirstPage = () => {
    setPagination(prev => ({ ...prev, pageIndex: 0 }));
    setErrorMessage("");
  };

  const changeDateRange = (range: HistoryDateRange) => {
    setCustomRange(createDateRange(range));
    setDatePreset("custom");
    restartFromFirstPage();
  };

  const changeDatePreset = (preset: HistoryDatePreset) => {
    if (preset === "custom") {
      setCustomRange(dateRange);
    } else {
      restartFromFirstPage();
    }
    setDatePreset(preset);
  };

  const exportCsv = async () => {
    const { from: startDate, to: endDate } = resolveDateRange(datePreset, customRange);

    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const csv = await stripe.exportTransactionsCsv({
        startDate,
        endDate,
        timezone
      });

      const dateFrom = startDate.toLocaleDateString("en-CA", { timeZone: timezone });
      const dateTo = endDate.toLocaleDateString("en-CA", { timeZone: timezone });
      const filename = `transactions_${dateFrom}_${dateTo}`;

      downloadCsv(csv, filename);
    } catch (error) {
      toast({
        title: "Failed to export transactions",
        description: axios.isAxiosError(error) ? error.response?.data.message || "An error occurred while exporting transactions." : (error as Error).message,
        variant: "destructive"
      });
    }
  };

  return (
    <>
      {children({
        data: data?.transactions || [],
        onExport: exportCsv,
        onPaginationChange: handlePaginationChange,
        totalCount: data?.totalCount || 0,
        dateRange,
        onDateRangeChange: changeDateRange,
        datePreset,
        onDatePresetChange: changeDatePreset,
        pagination,
        isLoading,
        isFetching,
        isError,
        errorMessage
      })}
    </>
  );
};

/** Presets resolve against today on every read so a page left open past midnight still lists new payments. */
function resolveDateRange(preset: HistoryDatePreset, customRange: HistoryDateRange) {
  return preset === "custom" ? customRange : getHistoryPresetRange(preset);
}
