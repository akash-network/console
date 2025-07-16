import React, { type FC } from "react";

import { useWallet } from "@src/context/WalletProvider";
import { useUsage, useUsageStats } from "@src/queries";
import type { UsageHistory, UsageHistoryStats } from "@src/types";

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
};

export type UsageContainerProps = {
  children: (props: ChildrenProps) => React.ReactNode;
  dependencies?: typeof DEPENDENCIES;
};

export const UsageContainer: FC<UsageContainerProps> = ({ children, dependencies: d = DEPENDENCIES }) => {
  const { address } = d.useWallet();
  const {
    data: usageHistoryData = [],
    isError: isUsageHistoryError,
    isFetching: isFetchingUsageHistory
  } = d.useUsage({
    address
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
    address
  });

  return (
    <>
      {children({
        usageHistoryData,
        usageHistoryStatsData,
        isFetchingUsageHistory,
        isUsageHistoryError,
        isFetchingUsageHistoryStats,
        isUsageHistoryStatsError
      })}
    </>
  );
};
