import React from "react";
import { FormattedNumber } from "react-intl";
import { Button, Card, CardContent, CardHeader, CardTitle, DateRangePicker, Label } from "@akashnetwork/ui/components";
import LinearProgress from "@mui/material/LinearProgress";
import { startOfDay, subYears } from "date-fns";
import { Cloud, DollarSign, Download } from "lucide-react";

import { Title } from "@src/components/shared/Title";
import { CreditsUsageAreaChart } from "@src/components/usage/usage-tab/charts/CreditsUsageAreaChart";
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

type UsageViewProps = {
  usageHistoryData: UsageHistory;
  usageHistoryStatsData: UsageHistoryStats;
  creditsUsageData: Array<{
    date: string;
    credits: number;
    used: number;
  }>;
  dateRange: { from: Date | undefined; to?: Date };
  onDateRangeChange: (range?: { from?: Date; to?: Date }) => void;
  isFetchingUsageHistory: boolean;
  isUsageHistoryError: boolean;
  isFetchingUsageHistoryStats: boolean;
  isUsageHistoryStatsError: boolean;
};

export const UsageView = ({
  usageHistoryData,
  usageHistoryStatsData,
  creditsUsageData,
  dateRange,
  onDateRangeChange,
  isFetchingUsageHistory,
  isUsageHistoryError,
  isFetchingUsageHistoryStats,
  isUsageHistoryStatsError
}: UsageViewProps) => {
  const oneYearAgo = startOfDay(subYears(new Date(), 1));

  const downloadCsv = () => {
    const csvContent =
      `data:text/csv;charset=utf-8,Date,Active Deployments,Daily AKT Spent,Total AKT Spent,Daily USDC Spent,Total USDC Spent,Daily USD Spent,Total USD Spent\n` +
      usageHistoryData
        .map(row => {
          return `${row.date},${row.activeDeployments},${row.dailyAktSpent},${row.totalAktSpent},${row.dailyUsdcSpent},${row.totalUsdcSpent},${row.dailyUsdSpent},${row.totalUsdSpent}`;
        })
        .join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `usage_data_${new Date().toISOString()}.csv`);
    document.body.appendChild(link); // Required for FF
    link.click();

    const statsCsvContent =
      `data:text/csv;charset=utf-8,Total Spent,Average Spent Per Day,Total Deployments,Average Deployments Per Day\n` +
      `${usageHistoryStatsData.totalSpent},${usageHistoryStatsData.averageSpentPerDay},${usageHistoryStatsData.totalDeployments},${usageHistoryStatsData.averageDeploymentsPerDay}`;
    const statsEncodedUri = encodeURI(statsCsvContent);
    const statsLink = document.createElement("a");
    statsLink.setAttribute("href", statsEncodedUri);
    statsLink.setAttribute("download", `usage_stats_${new Date().toISOString()}.csv`);
    document.body.appendChild(statsLink); // Required for FF
    statsLink.click();
  };

  return (
    <div className="h-full space-y-4">
      <div className="flex items-center justify-between">
        <Title subTitle>Overview</Title>
      </div>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Label>Filter by Date:</Label>
          <DateRangePicker date={dateRange} onDateChange={onDateRangeChange} className="mt-2 w-full" minDate={oneYearAgo} disableFuture maxRangeInDays={366} />
        </div>

        <Button variant="secondary" onClick={downloadCsv} className="h-12 gap-4">
          <Download size={16} />
          Export as CSV
        </Button>
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
          <CreditsUsageAreaChart data={creditsUsageData} isFetching={isFetchingUsageHistory} />
          <CumulativeSpendingLineChart data={usageHistoryData} isFetching={isFetchingUsageHistory} />
        </>
      )}
    </div>
  );
};
