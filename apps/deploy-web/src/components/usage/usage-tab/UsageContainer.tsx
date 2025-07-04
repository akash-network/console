import React, { type FC } from "react";

import { useWallet } from "@src/context/WalletProvider";
import { useUsage, useUsageStats } from "@src/queries";
import type { UsageHistory, UsageHistoryStats } from "@src/types";

type ChildrenProps = {
  usageHistoryData: UsageHistory;
  usageHistoryStatsData: UsageHistoryStats;
  isFetchingUsageHistory: boolean;
  isUsageHistoryError: boolean;
  isFetchingUsageHistoryStats: boolean;
  isUsageHistoryStatsError: boolean;
};

type UsageContainerProps = {
  children: (props: ChildrenProps) => React.ReactNode;
};

export const UsageContainer: FC<UsageContainerProps> = ({ children }) => {
  const { address } = useWallet();
  const {
    data: usageHistoryData = [],
    isError: isUsageHistoryError,
    isFetching: isFetchingUsageHistory
  } = useUsage({
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
  } = useUsageStats({
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
