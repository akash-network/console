import React, { type FC, useState } from "react";
import { format } from "date-fns";

import { useCurrentSpendRate } from "@src/components/billing-usage/useCurrentSpendRate";
import { canViewBillingAndUsage } from "@src/components/organizations/organizationAccess";
import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useUsage, useUsageStats } from "@src/queries";
import type { UsageHistory, UsageHistoryStats } from "@src/types";
import type { SpendRange } from "@src/types/project-budget";
import { createDateRange } from "@src/utils/dateUtils";
import { downloadCsv } from "@src/utils/domUtils";
import { buildUsageCsv } from "./buildUsageCsv";
import { getSpendChangePercent } from "./getSpendChangePercent";
import {
  countDaysInRange,
  DEFAULT_USAGE_DATE_PRESET,
  getPreviousPeriod,
  getUsagePresetRange,
  type UsageDatePreset,
  type UsageDateRange
} from "./usageDatePresets";

export const DEPENDENCIES = {
  useWallet,
  useUsage,
  useUsageStats,
  useCurrentSpendRate,
  useActiveOrganization
};

const EMPTY_USAGE_STATS: UsageHistoryStats = {
  totalSpent: 0,
  averageSpentPerDay: 0,
  totalDeployments: 0,
  averageDeploymentsPerDay: 0
};

export type ChildrenProps = {
  usageHistoryData: UsageHistory;
  usageHistoryStatsData: UsageHistoryStats;
  spendChangePercent: number | null;
  isUsageHistoryLoading: boolean;
  isUsageHistoryError: boolean;
  isUsageHistoryStatsLoading: boolean;
  isUsageHistoryStatsError: boolean;
  spendRate: { perHourUsd: number; isLoading: boolean; isError: boolean };
  dateRange: UsageDateRange;
  onDateRangeChange: (range: UsageDateRange) => void;
  datePreset: UsageDatePreset;
  onDatePresetChange: (preset: UsageDatePreset) => void;
  canExport: boolean;
  onExport: () => void;
  /** Null unless the caller may see a team's spend by project. */
  projectSpendRange: SpendRange | null;
};

export type UsageContainerProps = {
  children: (props: ChildrenProps) => React.ReactNode;
  dependencies?: typeof DEPENDENCIES;
};

export const UsageContainer: FC<UsageContainerProps> = ({ children, dependencies: d = DEPENDENCIES }) => {
  const [datePreset, setDatePreset] = useState<UsageDatePreset>(DEFAULT_USAGE_DATE_PRESET);
  const [customRange, setCustomRange] = useState<UsageDateRange>(() => getUsagePresetRange(DEFAULT_USAGE_DATE_PRESET));
  const dateRange = resolveDateRange(datePreset, customRange);
  const previousPeriod = getPreviousPeriod(dateRange);
  const { address } = d.useWallet();

  const usageHistory = d.useUsage({ address, startDate: dateRange.from, endDate: dateRange.to });
  const usageStats = d.useUsageStats({ address, startDate: dateRange.from, endDate: dateRange.to });
  const previousPeriodStats = d.useUsageStats({ address, startDate: previousPeriod.from, endDate: previousPeriod.to });
  const { perHourUsd, isLoading: isSpendRateLoading, isError: isSpendRateError } = d.useCurrentSpendRate();
  const { activeOrganization, projectsEnabled } = d.useActiveOrganization();
  const showsSpendByProject = projectsEnabled && !!activeOrganization && canViewBillingAndUsage(activeOrganization.role);

  const usageHistoryData = usageHistory.data ?? [];
  const usageHistoryStatsData = usageStats.data ?? EMPTY_USAGE_STATS;

  const changeDateRange = (range: UsageDateRange) => {
    setCustomRange(createDateRange(range));
    setDatePreset("custom");
  };

  const changeDatePreset = (preset: UsageDatePreset) => {
    if (preset === "custom") {
      setCustomRange(dateRange);
    }
    setDatePreset(preset);
  };

  const exportCsv = () => {
    const csv = new Blob([buildUsageCsv(usageHistoryData, usageHistoryStatsData)], { type: "text/csv;charset=utf-8;" });
    downloadCsv(csv, "akash_billing_usage");
  };

  return (
    <>
      {children({
        usageHistoryData,
        usageHistoryStatsData,
        spendChangePercent: getSpendChangePercent({
          history: usageHistoryData,
          previousTotalSpent: previousPeriodStats.data?.totalSpent ?? null,
          previousDays: countDaysInRange(previousPeriod)
        }),
        isUsageHistoryLoading: usageHistory.isLoading,
        isUsageHistoryError: usageHistory.isError,
        isUsageHistoryStatsLoading: usageStats.isLoading,
        isUsageHistoryStatsError: usageStats.isError,
        spendRate: { perHourUsd, isLoading: isSpendRateLoading, isError: isSpendRateError },
        dateRange,
        onDateRangeChange: changeDateRange,
        datePreset,
        onDatePresetChange: changeDatePreset,
        canExport: !!usageHistory.data && !!usageStats.data && !usageHistory.isError && !usageStats.isError,
        onExport: exportCsv,
        projectSpendRange: showsSpendByProject ? toSpendRange(dateRange) : null
      })}
    </>
  );
};

/** Presets resolve against today on every read so a page left open past midnight moves on to the new day. */
function resolveDateRange(preset: UsageDatePreset, customRange: UsageDateRange) {
  return preset === "custom" ? customRange : getUsagePresetRange(preset);
}

function toSpendRange({ from, to }: UsageDateRange): SpendRange {
  return { startDate: format(from, "yyyy-MM-dd"), endDate: format(to, "yyyy-MM-dd") };
}
