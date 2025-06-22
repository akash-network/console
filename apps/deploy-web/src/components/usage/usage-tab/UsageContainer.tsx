import React, { type FC } from "react";

import mockCreditsUsageData from "@src/components/usage/usage-tab/mock-credits-usage-data";
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
  dateRange: [Date, Date];
  onDateRangeChange: (range: [Date, Date]) => void;
  isFetchingUsageHistory: boolean;
  isUsageHistoryError: boolean;
  isFetchingUsageHistoryStats: boolean;
  isUsageHistoryStatsError: boolean;
};

type UsageContainerProps = {
  children: (props: ChildrenProps) => React.ReactNode;
};

export const UsageContainer: FC<UsageContainerProps> = ({ children }) => {
  const [dateRange, setDateRange] = React.useState<[Date, Date]>(() => createDateRange());
  const address = "akash18andxgtd6r08zzfpcdqg9pdr6smks7gv76tyt6"; // TODO: Replace with actual address of current user
  const [startDate, endDate] = dateRange;
  const {
    data: usageHistoryData = [],
    isError: isUsageHistoryError,
    isFetching: isFetchingUsageHistory
  } = useUsage({
    address,
    startDate,
    endDate
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
    address,
    startDate,
    endDate
  });

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
          const date = new Date(item.date);

          return date >= startDate && date <= endDate;
        }),
        dateRange,
        onDateRangeChange: setDateRange,
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
