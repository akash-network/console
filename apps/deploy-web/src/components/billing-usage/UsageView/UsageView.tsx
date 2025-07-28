import React from "react";
import { FormattedNumber } from "react-intl";
import { Button, Card, CardContent, CardHeader, CardTitle, DateRangePicker, Label } from "@akashnetwork/ui/components";
import LinearProgress from "@mui/material/LinearProgress";
import { endOfToday, startOfDay, subYears } from "date-fns";
import { Cloud, Dollar, Download } from "iconoir-react";

import { CumulativeSpendingLineChart } from "@src/components/billing-usage/CumulativeSpendingLineChart/CumulativeSpendingLineChart";
import { DailyUsageBarChart } from "@src/components/billing-usage/DailyUsageBarChart/DailyUsageBarChart";
import { Title } from "@src/components/shared/Title";
import type { UsageHistory, UsageHistoryStats } from "@src/types";
import { downloadCsv } from "@src/utils/domUtils";
import { sanitizeCsvField } from "@src/utils/stringUtils";

const isValidNumber = (value: number | null | undefined): boolean => {
  return value !== null && value !== undefined && !Number.isNaN(value) && Number.isFinite(value);
};

export const COMPONENTS = {
  FormattedNumber,
  Title,
  DailyUsageBarChart,
  CumulativeSpendingLineChart,
  LinearProgress,
  DateRangePicker
};

export type UsageViewProps = {
  usageHistoryData: UsageHistory;
  usageHistoryStatsData: UsageHistoryStats;
  isFetchingUsageHistory: boolean;
  isUsageHistoryError: boolean;
  isFetchingUsageHistoryStats: boolean;
  isUsageHistoryStatsError: boolean;
  dateRange: { from: Date | undefined; to?: Date };
  onDateRangeChange: (range?: { from?: Date; to?: Date }) => void;
  components?: typeof COMPONENTS;
};

export const UsageView = ({
  usageHistoryData,
  usageHistoryStatsData,
  isFetchingUsageHistory,
  isUsageHistoryError,
  isFetchingUsageHistoryStats,
  isUsageHistoryStatsError,
  dateRange,
  onDateRangeChange,
  components = COMPONENTS
}: UsageViewProps) => {
  const oneYearAgo = startOfDay(subYears(new Date(), 1));

  const { FormattedNumber, Title, DailyUsageBarChart, CumulativeSpendingLineChart, LinearProgress, DateRangePicker } = components;

  const exportCsv = React.useCallback(() => {
    const statsCsvContent = [
      "Usage Stats",
      "Total Spent,Average Spent Per Day,Total Deployments,Average Deployments Per Day",
      [
        usageHistoryStatsData.totalSpent,
        usageHistoryStatsData.averageSpentPerDay,
        usageHistoryStatsData.totalDeployments,
        usageHistoryStatsData.averageDeploymentsPerDay
      ]
        .map(sanitizeCsvField)
        .join(",")
    ];

    const historyCsvContent = [
      "Usage History",
      "Date,Active Deployments,Daily AKT Spent,Total AKT Spent,Daily USDC Spent,Total USDC Spent,Daily USD Spent,Total USD Spent",
      ...usageHistoryData.map(row =>
        [row.date, row.activeDeployments, row.dailyAktSpent, row.totalAktSpent, row.dailyUsdcSpent, row.totalUsdcSpent, row.dailyUsdSpent, row.totalUsdSpent]
          .map(sanitizeCsvField)
          .join(",")
      )
    ];

    const combinedCsvContent = [...statsCsvContent, ...historyCsvContent].join("\n");

    downloadCsv(combinedCsvContent, "akash_billing_usage");
  }, [usageHistoryData, usageHistoryStatsData]);

  return (
    <div className="h-full space-y-4">
      <Title subTitle>Overview</Title>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Label>Filter by Date:</Label>
          <DateRangePicker date={dateRange} onChange={onDateRangeChange} className="w-full" minDate={oneYearAgo} maxDate={endOfToday()} maxRangeInDays={366} />
        </div>
        <Button variant="secondary" onClick={exportCsv} size="sm">
          <Download width={16} className="mr-2" />
          Export CSV
        </Button>
      </div>

      {isUsageHistoryStatsError && (
        <div className="flex h-full items-center justify-center">
          <p className="text-red-500">Error loading usage stats</p>
        </div>
      )}

      {!isUsageHistoryStatsError && (
        <div className="flex w-full flex-col gap-4 lg:flex-row lg:gap-8">
          <Card className="flex min-h-28 basis-1/2 flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-0">
              <CardTitle className="text-base">Total Spent</CardTitle>
              <Dollar color="#71717a" width={18} />
            </CardHeader>
            {isFetchingUsageHistoryStats ? (
              <div className="flex flex-1 items-center">
                <LinearProgress color="primary" className="mx-auto w-11/12" />
              </div>
            ) : (
              <CardContent className="pt-2">
                {isValidNumber(usageHistoryStatsData.totalSpent) ? (
                  <div className="text-3xl font-bold">
                    <FormattedNumber value={usageHistoryStatsData.totalSpent} style="currency" currency="USD" currencyDisplay="narrowSymbol" />
                  </div>
                ) : (
                  <p className="text-gray-400">No data</p>
                )}
                {isValidNumber(usageHistoryStatsData.averageSpentPerDay) && (
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
              <Cloud color="#71717a" width={18} />
            </CardHeader>
            {isFetchingUsageHistoryStats ? (
              <div className="flex flex-1 items-center">
                <LinearProgress color="primary" className="mx-auto w-11/12" />
              </div>
            ) : (
              <CardContent className="pt-2">
                {isValidNumber(usageHistoryStatsData.totalDeployments) ? (
                  <div className="text-3xl font-bold">
                    <FormattedNumber value={usageHistoryStatsData.totalDeployments} />
                  </div>
                ) : (
                  <p className="text-gray-400">No data</p>
                )}
                {isValidNumber(usageHistoryStatsData.averageDeploymentsPerDay) && (
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
        <div className="flex h-full items-center justify-center">
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
