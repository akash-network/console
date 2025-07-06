import React from "react";
import { FormattedNumber } from "react-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@akashnetwork/ui/components";
import LinearProgress from "@mui/material/LinearProgress";
import { Cloud, DollarSign } from "lucide-react";

import { Title } from "@src/components/shared/Title";
import { CumulativeSpendingLineChart } from "@src/components/usage/usage-tab/charts/CumulativeSpendingLineChart";
import { DailyUsageBarChart } from "@src/components/usage/usage-tab/charts/DailyUsageBarChart";

export type UsageHistory = Array<{
  date: string;
  activeDeployments: number;
  dailyAktSpent: number;
  totalAktSpent: number;
  dailyUsdcSpent: number;
  totalUsdcSpent: number;
  dailyUsdSpent: number;
  totalUsdSpent: number;
}>;

export type UsageHistoryStats = {
  totalSpent: number;
  averageSpentPerDay: number;
  totalDeployments: number;
  averageDeploymentsPerDay: number;
};

export type UsageViewProps = {
  usageHistoryData: UsageHistory;
  usageHistoryStatsData: UsageHistoryStats;
  isFetchingUsageHistory: boolean;
  isUsageHistoryError: boolean;
  isFetchingUsageHistoryStats: boolean;
  isUsageHistoryStatsError: boolean;
};

export const UsageView = ({
  usageHistoryData,
  usageHistoryStatsData,
  isFetchingUsageHistory,
  isUsageHistoryError,
  isFetchingUsageHistoryStats,
  isUsageHistoryStatsError
}: UsageViewProps) => {
  return (
    <div className="h-full space-y-4">
      <Title subTitle>Overview</Title>

      {isUsageHistoryStatsError && (
        <div className="mt-4 flex h-full items-center justify-center">
          <p className="text-red-500">Error loading usage stats</p>
        </div>
      )}

      {!isUsageHistoryStatsError && (
        <div className="flex w-full flex-col gap-4 lg:flex-row lg:gap-8">
          <Card className="flex min-h-28 basis-1/2 flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-0">
              <CardTitle className="text-base">Total Spent</CardTitle>
              <DollarSign color="#71717a" size={18} />
            </CardHeader>
            {isFetchingUsageHistoryStats ? (
              <div className="flex flex-1 items-center">
                <LinearProgress color="primary" className="mx-auto w-11/12" />
              </div>
            ) : (
              <CardContent className="pt-2">
                {Number.isNaN(Number(usageHistoryStatsData.totalSpent)) ? (
                  <p className="text-gray-400">No data</p>
                ) : (
                  <div className="text-3xl font-bold">
                    <FormattedNumber value={usageHistoryStatsData.totalSpent} style="currency" currency="USD" currencyDisplay="narrowSymbol" />
                  </div>
                )}
                {!Number.isNaN(Number(usageHistoryStatsData.averageSpentPerDay)) && (
                  <div className="text-sm font-semibold text-gray-400">
                    <FormattedNumber value={usageHistoryStatsData.averageSpentPerDay} style="currency" currency="USD" currencyDisplay="narrowSymbol" /> average
                    per day
                  </div>
                )}
              </CardContent>
            )}
          </Card>
          <Card className="flex min-h-28 basis-1/2 flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-0">
              <CardTitle className="text-base">Total Deployments</CardTitle>
              <Cloud color="#71717a" size={18} />
            </CardHeader>
            {isFetchingUsageHistoryStats ? (
              <div className="flex flex-1 items-center">
                <LinearProgress color="primary" className="mx-auto w-11/12" />
              </div>
            ) : (
              <CardContent className="pt-2">
                {Number.isNaN(Number(usageHistoryStatsData.totalDeployments)) ? (
                  <p className="text-gray-400">No data</p>
                ) : (
                  <div className="text-3xl font-bold">
                    <FormattedNumber value={usageHistoryStatsData.totalDeployments} />
                  </div>
                )}
                {!Number.isNaN(Number(usageHistoryStatsData.averageDeploymentsPerDay)) && (
                  <div className="text-sm font-semibold text-gray-400">
                    <FormattedNumber value={usageHistoryStatsData.averageDeploymentsPerDay} /> average per day
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        </div>
      )}

      <Title subTitle>Historical</Title>

      {isUsageHistoryError && (
        <div className="mt-4 flex h-full items-center justify-center">
          <p className="text-red-500">Error loading usage data</p>
        </div>
      )}

      {!isUsageHistoryError && (
        <>
          <DailyUsageBarChart data={usageHistoryData} isFetching={isFetchingUsageHistory} />
          <CumulativeSpendingLineChart data={usageHistoryData} isFetching={isFetchingUsageHistory} />
        </>
      )}
    </div>
  );
};
