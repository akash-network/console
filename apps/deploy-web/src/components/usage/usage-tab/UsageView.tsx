import React from "react";
import { FormattedNumber } from "react-intl";
import { Card, CardContent, CardHeader, CardTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@akashnetwork/ui/components";
import LinearProgress from "@mui/material/LinearProgress";
import { subDays } from "date-fns";
import { Cloud, DollarSign } from "lucide-react";

import { Title } from "@src/components/shared/Title";
import { CreditsUsageAreaChart } from "@src/components/usage/usage-tab/charts/CreditsUsageAreaChart";
import { CumulativeSpendingLineChart } from "@src/components/usage/usage-tab/charts/CumulativeSpendingLineChart";
import { DailyUsageBarChart } from "@src/components/usage/usage-tab/charts/DailyUsageBarChart";
import type { UsageHistory, UsageHistoryStats } from "@src/types";
import { createDateRange } from "@src/utils/dateUtils";

type UsageViewProps = {
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

export const UsageView = ({
  usageHistoryData,
  usageHistoryStatsData,
  creditsUsageData,
  onDateRangeChange,
  isFetchingUsageHistory,
  isUsageHistoryError,
  isFetchingUsageHistoryStats,
  isUsageHistoryStatsError
}: UsageViewProps) => {
  const [daysAgo, setDaysAgo] = React.useState("90");

  React.useEffect(() => {
    if (Number.isNaN(Number(daysAgo))) {
      throw new Error("daysAgo should be a valid number string");
    }

    onDateRangeChange(
      createDateRange({
        startDate: subDays(new Date(), Number(daysAgo))
      })
    );
  }, [daysAgo, onDateRangeChange]);

  return (
    <div className="h-full space-y-4">
      <div className="flex items-center justify-between">
        <Title subTitle>Overview</Title>

        <Select value={daysAgo} onValueChange={setDaysAgo}>
          <SelectTrigger className="w-[160px] rounded-lg sm:ml-auto" aria-label="Select a value">
            <SelectValue placeholder="Last 3 months" />
          </SelectTrigger>

          <SelectContent className="rounded-xl">
            <SelectItem value="90" className="rounded-lg">
              Last 3 months
            </SelectItem>
            <SelectItem value="30" className="rounded-lg">
              Last 30 days
            </SelectItem>
            <SelectItem value="7" className="rounded-lg">
              Last 7 days
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

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
                    <FormattedNumber value={usageHistoryStatsData.totalDeployments} style="currency" currency="USD" currencyDisplay="narrowSymbol" />
                  </div>
                )}
                {!Number.isNaN(Number(usageHistoryStatsData.averageDeploymentsPerDay)) && (
                  <div className="text-sm font-semibold text-gray-400">
                    <FormattedNumber value={usageHistoryStatsData.averageDeploymentsPerDay} style="currency" currency="USD" currencyDisplay="narrowSymbol" />{" "}
                    average per day
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
          <CreditsUsageAreaChart data={creditsUsageData} isFetching={isFetchingUsageHistory} />
          <CumulativeSpendingLineChart data={usageHistoryData} isFetching={isFetchingUsageHistory} />
        </>
      )}
    </div>
  );
};
