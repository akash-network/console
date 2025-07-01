import React, { type FC } from "react";

import mockCreditsUsageData from "@src/components/usage/usage-tab/mock-credits-usage-data";
import { useWallet } from "@src/context/WalletProvider";
import { useUsage, useUsageStats } from "@src/queries";
import type { UsageHistory, UsageHistoryStats } from "@src/types";
import { createDateRange } from "@src/utils/dateUtils";

type ChildrenProps = {
  usageHistoryData: UsageHistory;
  usageHistoryStatsData: UsageHistoryStats;
  creditsUsageData: Array<{
    date: string;
    credits: number;
    used: number;
  }>;
  dateRange: { from?: Date; to?: Date };
  onDateRangeChange: (range?: { from?: Date; to?: Date }) => void;
  isFetchingUsageHistory: boolean;
  isUsageHistoryError: boolean;
  isFetchingUsageHistoryStats: boolean;
  isUsageHistoryStatsError: boolean;
};

type UsageContainerProps = {
  children: (props: ChildrenProps) => React.ReactNode;
};

export const UsageContainer: FC<UsageContainerProps> = ({ children }) => {
  const [dateRange, setDateRange] = React.useState<{ from?: Date; to?: Date }>(() => createDateRange());
  const { address } = useWallet();
  const { from, to } = dateRange;
  const {
    data: usageHistoryData = [],
    isError: isUsageHistoryError,
    isFetching: isFetchingUsageHistory
  } = useUsage(
    {
      address,
      startDate: from,
      endDate: to
    },
    {
      enabled: !!dateRange.from && !!dateRange.to
    }
  );
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
    address,
    startDate: from,
    endDate: to
  });

  const changeDateRange = (range?: { from?: Date; to?: Date }) => {
    setDateRange(createDateRange(range));
  };

  return (
    <>
      {children({
        // usageHistoryData: [],
        usageHistoryData,
        // usageHistoryStatsData: {
        //   totalSpent: 0,
        //   averageSpentPerDay: 0,
        //   totalDeployments: 0,
        //   averageDeploymentsPerDay: 0
        // },
        usageHistoryStatsData,
        /* TODO: Replace mockCreditsUsageData with actual data after figuring out where it should come from */
        // creditsUsageData: [],
        creditsUsageData: mockCreditsUsageData.filter(item => {
          if (!from || !to) {
            return false;
          }

          const date = new Date(item.date);

          return date >= from && date <= to;
        }),
        dateRange,
        onDateRangeChange: changeDateRange,
        // isFetchingUsageHistory: true,
        isFetchingUsageHistory,
        // isUsageHistoryError: true,
        isUsageHistoryError,
        // isFetchingUsageHistoryStats: true,
        isFetchingUsageHistoryStats,
        // isUsageHistoryStatsError: true,
        isUsageHistoryStatsError
      })}
    </>
  );
};
