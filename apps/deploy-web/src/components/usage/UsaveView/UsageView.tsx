import React from "react";
import { FormattedNumber } from "react-intl";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@akashnetwork/ui/components";
import LinearProgress from "@mui/material/LinearProgress";
import { Cloud, Dollar, Download } from "iconoir-react";

import { Title } from "@src/components/shared/Title";
import { CumulativeSpendingLineChart } from "@src/components/usage/CumulativeSpendingLineChart/CumulativeSpendingLineChart";
import { DailyUsageBarChart } from "@src/components/usage/DailyUsageBarChart/DailyUsageBarChart";
import type { UsageHistory, UsageHistoryStats } from "@src/types";

const escapeCSVValue = (value: string | number): string => {
  const stringValue = String(value);
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const downloadCSV = (content: string, filename: string) => {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const DEPENDENCIES = {
  FormattedNumber,
  Title,
  DailyUsageBarChart,
  CumulativeSpendingLineChart,
  LinearProgress
};

export type UsageViewProps = {
  usageHistoryData: UsageHistory;
  usageHistoryStatsData: UsageHistoryStats;
  isFetchingUsageHistory: boolean;
  isUsageHistoryError: boolean;
  isFetchingUsageHistoryStats: boolean;
  isUsageHistoryStatsError: boolean;
  dependencies?: typeof DEPENDENCIES;
};

export const UsageView = ({
  usageHistoryData,
  usageHistoryStatsData,
  isFetchingUsageHistory,
  isUsageHistoryError,
  isFetchingUsageHistoryStats,
  isUsageHistoryStatsError,
  dependencies = DEPENDENCIES
}: UsageViewProps) => {
  const { FormattedNumber, Title, DailyUsageBarChart, CumulativeSpendingLineChart, LinearProgress } = dependencies;

  const exportCSV = React.useCallback(() => {
    const historyCsvContent = usageHistoryData.map(row => Object.values(row).map(escapeCSVValue).join(",")).join("\n");

    downloadCSV(historyCsvContent, "usage_history.csv");

    const statsCsvContent = [
      "Total Spent,Average Spent Per Day,Total Deployments,Average Deployments Per Day",
      [
        usageHistoryStatsData.totalSpent,
        usageHistoryStatsData.averageSpentPerDay,
        usageHistoryStatsData.totalDeployments,
        usageHistoryStatsData.averageDeploymentsPerDay
      ]
        .map(escapeCSVValue)
        .join(",")
    ].join("\n");

    downloadCSV(statsCsvContent, "usage_stats.csv");
  }, [usageHistoryData, usageHistoryStatsData]);

  return (
    <div className="h-full space-y-4">
      <div className="flex items-center justify-between">
        <Title subTitle>Overview</Title>

        <Button variant="secondary" onClick={exportCSV} size="sm">
          <Download width={16} className="mr-2" />
          Export CSV
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
              <Dollar color="#71717a" width={18} />
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
              <Cloud color="#71717a" width={18} />
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
