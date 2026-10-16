import React, { type FC, useState } from "react";
import { format } from "date-fns";

import type { DailySpend, SpendSeries } from "@src/components/billing-usage/DailySpendChart/DailySpendChart";
import { useCurrentSpendRate } from "@src/components/billing-usage/useCurrentSpendRate";
import { canViewBillingAndUsage } from "@src/components/organizations/organizationAccess";
import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useUsage, useUsageStats } from "@src/queries";
import { useDeploymentSpendQuery } from "@src/queries/useProjectBudgetQueries";
import { useProjectsQuery } from "@src/queries/useProjectsQuery";
import type { UsageHistoryStats } from "@src/types";
import type { DeploymentSpendReport } from "@src/types/deployment-spend";
import type { SpendRange } from "@src/types/project-budget";
import { createDateRange } from "@src/utils/dateUtils";
import { downloadCsv } from "@src/utils/domUtils";
import { buildUsageCsv } from "./buildUsageCsv";
import { getSpendChangePercent } from "./getSpendChangePercent";
import { hourlyRateOf, type ProjectScope, projectSeriesOf, type ScopedUsage, scopeUsage } from "./teamUsage";
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
  useActiveOrganization,
  useDeploymentSpendQuery,
  useProjectsQuery
};

const EMPTY_USAGE_STATS: UsageHistoryStats = {
  totalSpent: 0,
  averageSpentPerDay: 0,
  totalDeployments: 0,
  averageDeploymentsPerDay: 0
};

export type ProjectScopeControl = {
  projects: Array<{ id: string; name: string }>;
  selected: ProjectScope;
  onChange: (scope: ProjectScope) => void;
};

export type DailySpendBreakdown = { caption: string; series: SpendSeries[] };

export type ChildrenProps = {
  usageHistoryData: DailySpend[];
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
  /** Null unless the caller may see a team's spend by project and the page covers every project. */
  projectSpendRange: SpendRange | null;
  /** Null outside a team, whose usage alone can be narrowed to one project. */
  projectScope: ProjectScopeControl | null;
  /** Null outside a team, whose daily spend alone is split by project. */
  dailySpendBreakdown: DailySpendBreakdown | null;
};

type UsageFigures = Pick<
  ChildrenProps,
  "usageHistoryData" | "usageHistoryStatsData" | "isUsageHistoryLoading" | "isUsageHistoryError" | "isUsageHistoryStatsLoading" | "isUsageHistoryStatsError"
> & { previousTotalSpent: number | null };

type ReportQuery = { data?: DeploymentSpendReport; isLoading: boolean; isError: boolean };

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
  const { perBlockUsdByDseq, perHourUsd, isLoading: isSpendRateLoading, isError: isSpendRateError } = d.useCurrentSpendRate();
  const { activeOrganization, projectsEnabled } = d.useActiveOrganization();
  const isTeamUsage = projectsEnabled && !!activeOrganization && canViewBillingAndUsage(activeOrganization.role);
  const [projectScope, setProjectScope] = useState<ProjectScope>(null);
  const teamSpend = d.useDeploymentSpendQuery(toSpendRange(dateRange), { enabled: isTeamUsage });
  const previousTeamSpend = d.useDeploymentSpendQuery(toSpendRange(previousPeriod), { enabled: isTeamUsage });
  const projects = d.useProjectsQuery({ enabled: isTeamUsage });
  const scopedUsage = teamSpend.data && scopeUsage(teamSpend.data, projectScope);
  const scopeProjects = (projects.data ?? []).map(({ id, name }) => ({ id, name }));
  const isScopedToProject = isTeamUsage && projectScope !== null;

  const usageHistoryData = usageHistory.data ?? [];
  const usageHistoryStatsData = usageStats.data ?? EMPTY_USAGE_STATS;
  const figures: UsageFigures = isTeamUsage
    ? teamFiguresOf({ current: teamSpend, currentUsage: scopedUsage, previous: previousTeamSpend, scope: projectScope })
    : {
        usageHistoryData,
        usageHistoryStatsData,
        isUsageHistoryLoading: usageHistory.isLoading,
        isUsageHistoryError: usageHistory.isError,
        isUsageHistoryStatsLoading: usageStats.isLoading,
        isUsageHistoryStatsError: usageStats.isError,
        previousTotalSpent: previousPeriodStats.data?.totalSpent ?? null
      };

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
        usageHistoryData: figures.usageHistoryData,
        usageHistoryStatsData: figures.usageHistoryStatsData,
        spendChangePercent: getSpendChangePercent({
          history: figures.usageHistoryData,
          previousTotalSpent: figures.previousTotalSpent,
          previousDays: countDaysInRange(previousPeriod)
        }),
        isUsageHistoryLoading: figures.isUsageHistoryLoading,
        isUsageHistoryError: figures.isUsageHistoryError,
        isUsageHistoryStatsLoading: figures.isUsageHistoryStatsLoading,
        isUsageHistoryStatsError: figures.isUsageHistoryStatsError,
        spendRate: {
          perHourUsd: isScopedToProject ? hourlyRateOf(perBlockUsdByDseq, scopedUsage?.dseqs ?? []) : perHourUsd,
          isLoading: isSpendRateLoading || (isScopedToProject && teamSpend.isLoading),
          isError: isSpendRateError || (isScopedToProject && teamSpend.isError)
        },
        dateRange,
        onDateRangeChange: changeDateRange,
        datePreset,
        onDatePresetChange: changeDatePreset,
        canExport: !!usageHistory.data && !!usageStats.data && !usageHistory.isError && !usageStats.isError,
        onExport: exportCsv,
        projectSpendRange: isTeamUsage && !isScopedToProject ? toSpendRange(dateRange) : null,
        projectScope: isTeamUsage ? { projects: scopeProjects, selected: projectScope, onChange: setProjectScope } : null,
        dailySpendBreakdown: isTeamUsage
          ? dailySpendBreakdownOf({ report: teamSpend.data, scope: projectScope, projects: scopeProjects, onSelect: setProjectScope })
          : null
      })}
    </>
  );
};

/** Presets resolve against today on every read so a page left open past midnight moves on to the new day. */
function resolveDateRange(preset: UsageDatePreset, customRange: UsageDateRange) {
  return preset === "custom" ? customRange : getUsagePresetRange(preset);
}

function teamFiguresOf({
  current,
  currentUsage,
  previous,
  scope
}: {
  current: ReportQuery;
  currentUsage: ScopedUsage | undefined;
  previous: ReportQuery;
  scope: ProjectScope;
}): UsageFigures {
  return {
    usageHistoryData: currentUsage?.dailySpend ?? [],
    usageHistoryStatsData: currentUsage?.stats ?? EMPTY_USAGE_STATS,
    isUsageHistoryLoading: current.isLoading,
    isUsageHistoryError: current.isError,
    isUsageHistoryStatsLoading: current.isLoading,
    isUsageHistoryStatsError: current.isError,
    previousTotalSpent: previous.data ? scopeUsage(previous.data, scope).stats.totalSpent : null
  };
}

function dailySpendBreakdownOf({
  report,
  scope,
  projects,
  onSelect
}: {
  report: DeploymentSpendReport | undefined;
  scope: ProjectScope;
  projects: ProjectScopeControl["projects"];
  onSelect: (projectId: string) => void;
}): DailySpendBreakdown {
  if (scope !== null) {
    const projectName = projects.find(({ id }) => id === scope)?.name ?? "this project";
    return { caption: `Each bar is one day's total for ${projectName}`, series: [] };
  }

  return { caption: "Each bar is one day's total, split by project", series: report ? projectSeriesOf(report, onSelect) : [] };
}

function toSpendRange({ from, to }: UsageDateRange): SpendRange {
  return { startDate: format(from, "yyyy-MM-dd"), endDate: format(to, "yyyy-MM-dd") };
}
