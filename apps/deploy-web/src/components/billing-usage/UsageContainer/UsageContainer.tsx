import React, { type FC, useState } from "react";
import { format } from "date-fns";

import type { DailySpend, SpendSeries } from "@src/components/billing-usage/DailySpendChart/DailySpendChart";
import type { DeploymentSpendSection } from "@src/components/billing-usage/DeploymentSpendList/DeploymentSpendList";
import type { ProjectSpendSection } from "@src/components/billing-usage/ProjectSpendList/ProjectSpendList";
import { useCurrentSpendRate } from "@src/components/billing-usage/useCurrentSpendRate";
import { canViewBillingAndUsage } from "@src/components/organizations/organizationAccess";
import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useUsage, useUsageStats } from "@src/queries";
import { useDeploymentSpendQuery, useProjectSpendQuery } from "@src/queries/useProjectBudgetQueries";
import { useProjectsQuery } from "@src/queries/useProjectsQuery";
import type { UsageHistory, UsageHistoryStats } from "@src/types";
import type { DeploymentSpendReport } from "@src/types/deployment-spend";
import { MAX_PROJECT_SLUG_LENGTH, type Project } from "@src/types/project";
import type { SpendRange } from "@src/types/project-budget";
import { createDateRange } from "@src/utils/dateUtils";
import { downloadCsv } from "@src/utils/domUtils";
import { slugify } from "@src/utils/slugify";
import { buildProjectUsageCsv, buildUsageCsv } from "./buildUsageCsv";
import { getSpendChangePercent } from "./getSpendChangePercent";
import { deploymentRowsOf, hourlyRateOf, type ProjectScope, projectSeriesOf, projectSpendRowsOf, type ScopedUsage, scopeUsage } from "./teamUsage";
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
  useProjectSpendQuery,
  useProjectsQuery
};

const EMPTY_USAGE_STATS: UsageHistoryStats = {
  totalSpent: 0,
  averageSpentPerDay: 0,
  totalDeployments: 0,
  averageDeploymentsPerDay: 0
};

const USAGE_EXPORT_FILENAME = "akash_billing_usage";

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
  projectSpend: ProjectSpendSection | null;
  /** Null outside a team, whose usage alone can be narrowed to one project. */
  projectScope: ProjectScopeControl | null;
  /** Null outside a team, whose daily spend alone is split by project. */
  dailySpendBreakdown: DailySpendBreakdown | null;
  /** Null outside a team, whose spend alone is broken down by deployment. */
  deploymentSpend: DeploymentSpendSection | null;
};

type UsageFigures = Pick<
  ChildrenProps,
  "usageHistoryData" | "usageHistoryStatsData" | "isUsageHistoryLoading" | "isUsageHistoryError" | "isUsageHistoryStatsLoading" | "isUsageHistoryStatsError"
> & { previousTotalSpent: number | null };

type ReportQuery = { data?: DeploymentSpendReport; isLoading: boolean; isError: boolean };

type UsageExport = { filename: string; buildCsv: () => string };

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
  const projectSpend = d.useProjectSpendQuery(toSpendRange(dateRange), { enabled: isTeamUsage });
  const projects = d.useProjectsQuery({ enabled: isTeamUsage });
  const scopedUsage = teamSpend.data && scopeUsage(teamSpend.data, projectScope);
  const scopeProjects = (projects.data ?? []).map(({ id, name }) => ({ id, name }));
  const isScopedToProject = isTeamUsage && projectScope !== null;
  const scopedProject = projects.data?.find(({ id }) => id === projectScope);
  const scopedProjectName = projectScope === null ? null : scopedProject?.name ?? "this project";

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

  const usageExport = isScopedToProject
    ? projectUsageExportOf({ usage: scopedUsage, project: scopedProject, isError: teamSpend.isError })
    : walletUsageExportOf({ history: usageHistory, stats: usageStats });

  const exportCsv = () => {
    if (usageExport) {
      downloadCsv(new Blob([usageExport.buildCsv()], { type: "text/csv;charset=utf-8;" }), usageExport.filename);
    }
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
        canExport: usageExport !== null,
        onExport: exportCsv,
        projectSpend:
          isTeamUsage && !isScopedToProject
            ? {
                rows: projectSpend.data ? projectSpendRowsOf(projectSpend.data, teamSpend.data, setProjectScope) : [],
                isEstimated: !!projectSpend.data?.isEstimated,
                isPartial: !!projectSpend.data && !projectSpend.data.total,
                isLoading: projectSpend.isLoading || teamSpend.isLoading,
                isError: projectSpend.isError || teamSpend.isError
              }
            : null,
        projectScope: isTeamUsage ? { projects: scopeProjects, selected: projectScope, onChange: setProjectScope } : null,
        dailySpendBreakdown: isTeamUsage ? dailySpendBreakdownOf({ report: teamSpend.data, scopedProjectName, onSelect: setProjectScope }) : null,
        deploymentSpend: isTeamUsage
          ? {
              title: scopedProjectName === null ? "Spend by deployment" : `Spend by deployment · ${scopedProjectName}`,
              rows: teamSpend.data ? deploymentRowsOf(teamSpend.data, projectScope) : [],
              showsProject: projectScope === null,
              isLoading: teamSpend.isLoading,
              isError: teamSpend.isError
            }
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
  scopedProjectName,
  onSelect
}: {
  report: DeploymentSpendReport | undefined;
  scopedProjectName: string | null;
  onSelect: (projectId: string) => void;
}): DailySpendBreakdown {
  if (scopedProjectName !== null) {
    return { caption: `Each bar is one day's total for ${scopedProjectName}`, series: [] };
  }

  return { caption: "Each bar is one day's total, split by project", series: report ? projectSeriesOf(report, onSelect) : [] };
}

function walletUsageExportOf({
  history,
  stats
}: {
  history: { data?: UsageHistory; isError: boolean };
  stats: { data?: UsageHistoryStats; isError: boolean };
}): UsageExport | null {
  const { data: historyData } = history;
  const { data: statsData } = stats;
  if (!historyData || !statsData || history.isError || stats.isError) {
    return null;
  }

  return { filename: USAGE_EXPORT_FILENAME, buildCsv: () => buildUsageCsv(historyData, statsData) };
}

/** A name with no latin letter or digit slugifies to nothing, and the api gave such a project a generated slug instead. */
function projectUsageExportOf({
  usage,
  project,
  isError
}: {
  usage: ScopedUsage | undefined;
  project: Project | undefined;
  isError: boolean;
}): UsageExport | null {
  if (!usage || !project || isError) {
    return null;
  }

  return {
    filename: `${USAGE_EXPORT_FILENAME}_${slugify(project.name, MAX_PROJECT_SLUG_LENGTH) || project.slug}`,
    buildCsv: () => buildProjectUsageCsv(usage.dailySpend, usage.stats)
  };
}

function toSpendRange({ from, to }: UsageDateRange): SpendRange {
  return { startDate: format(from, "yyyy-MM-dd"), endDate: format(to, "yyyy-MM-dd") };
}
