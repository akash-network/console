import React, { type FC } from "react";

import { useWallet } from "@src/context/WalletProvider";
import { useUsage, useUsageStats } from "@src/queries";
import type { UsageHistory, UsageHistoryStats } from "@src/types";
import { createDateRange } from "@src/utils/dateUtils";

const DEPENDENCIES = {
  useWallet,
  useUsage,
  useUsageStats
};

export type ChildrenProps = {
  usageHistoryData: UsageHistory;
  usageHistoryStatsData: UsageHistoryStats;
  isFetchingUsageHistory: boolean;
  isUsageHistoryError: boolean;
  isFetchingUsageHistoryStats: boolean;
  isUsageHistoryStatsError: boolean;
  dateRange: { from: Date | undefined; to?: Date };
  onDateRangeChange: (range?: { from?: Date; to?: Date }) => void;
};

export type UsageContainerProps = {
  children: (props: ChildrenProps) => React.ReactNode;
  dependencies?: typeof DEPENDENCIES;
};

export const UsageContainer: FC<UsageContainerProps> = ({ children, dependencies: d = DEPENDENCIES }) => {
  const [dateRange, setDateRange] = React.useState<{ from: Date | undefined; to?: Date }>(() => createDateRange());
  const { address } = d.useWallet();
  const {
    data: usageHistoryData = [],
    isError: isUsageHistoryError,
    isFetching: isFetchingUsageHistory
  } = d.useUsage({
    address,
    startDate: dateRange.from,
    endDate: dateRange.to
  });
  const {
    data: usageHistoryStatsData = {
      totalSpent: 0,
      averageSpentPerDay: 0,
      totalDeployments: 0,
      averageDeploymentsPerDay: 0
    },
    isError: isUsageHistoryStatsError,
    isFetching: isFetchingUsageHistoryStats
  } = d.useUsageStats({
    address,
    startDate: dateRange.from,
    endDate: dateRange.to
  });

  const changeDateRange = (range?: { from?: Date; to?: Date }) => {
    setDateRange(createDateRange(range));
  };

  return (
    <>
      {children({
        usageHistoryData,
        usageHistoryStatsData,
        isFetchingUsageHistory,
        isUsageHistoryError,
        isFetchingUsageHistoryStats,
        isUsageHistoryStatsError,
        dateRange,
        onDateRangeChange: changeDateRange
      })}
    </>
  );
};
