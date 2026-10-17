import type { DailySpend, SpendSeries } from "@src/components/billing-usage/DailySpendChart/DailySpendChart";
import { spendShade } from "@src/components/billing-usage/spendShade";
import type { UsageHistoryStats } from "@src/types";
import type { DeploymentSpend, DeploymentSpendReport } from "@src/types/deployment-spend";
import type { ProjectSpendReport, SpendAmounts, SpendRange } from "@src/types/project-budget";
import { perBlockToHourly } from "@src/utils/priceUtils";

/** Null for the whole organization, or the id of the one project the page is narrowed to. */
export type ProjectScope = string | null;

/** Project ids are uuids, so the deployments filed in no project get a key no project can take. */
const UNASSIGNED_SERIES_KEY = "unassigned";

const UNASSIGNED_LABEL = "Unassigned";

/** The api lists every project its deployments are filed in, so this shows only if that contract breaks. */
const UNKNOWN_PROJECT_LABEL = "Unknown project";

export type DeploymentSpendRow = {
  dseq: string;
  name: string | null;
  projectName: string;
  hours: number;
  hourlyRateUsd: number;
  consumedUsd: number;
  sharePercent: number;
};

export type ProjectSpendRow = {
  key: string;
  label: string;
  onSelect?: () => void;
  deploymentCount: number;
  hours: number;
  consumedUsd: number;
  committedUsd: number;
  sharePercent: number;
  /** Null for a project that consumed nothing in the range, so it has no stack in the daily chart to match. */
  shade: string | null;
};

export type ScopedUsage = {
  dailySpend: DailySpend[];
  stats: UsageHistoryStats;
  dseqs: string[];
};

export function isInScope(projectId: string | null, scope: ProjectScope): boolean {
  return scope === null || projectId === scope;
}

/** Days without spend are absent from the report, so each day of its range is listed to give every day its bar. */
export function scopeUsage(report: DeploymentSpendReport, scope: ProjectScope): ScopedUsage {
  const spendBySeriesByDate = new Map<string, Record<string, number>>();
  report.days
    .filter(({ projectId }) => isInScope(projectId, scope))
    .forEach(({ date, projectId, consumedUsd }) => spendBySeriesByDate.set(date, { ...spendBySeriesByDate.get(date), [seriesKeyOf(projectId)]: consumedUsd }));
  const dailySpend = datesOf(report).map(date => {
    const spendBySeries = spendBySeriesByDate.get(date) ?? {};
    return { date, dailyUsdSpent: roundToCents(sumOf(Object.values(spendBySeries))), spendBySeries };
  });
  const deployments = report.deployments.filter(({ projectId }) => isInScope(projectId, scope));
  const dseqs = deployments.map(({ dseq }) => dseq);
  const totalSpent = roundToCents(sumOf(dailySpend.map(({ dailyUsdSpent }) => dailyUsdSpent)));

  return {
    dailySpend,
    stats: {
      totalSpent,
      averageSpentPerDay: totalSpent / dailySpend.length,
      totalDeployments: dseqs.length,
      averageDeploymentsPerDay: dseqs.length / dailySpend.length,
      ...(reportsGpuUsage(report) && gpuUsageOf(deployments))
    },
    dseqs
  };
}

/** The biggest spender of the range comes first and so gets the darkest shade, as in the spend by project rows. */
export function projectSeriesOf(report: DeploymentSpendReport, onSelect: (projectId: string) => void): SpendSeries[] {
  const spendByKey = new Map<string, number>();
  report.days.forEach(({ projectId, consumedUsd }) => spendByKey.set(seriesKeyOf(projectId), (spendByKey.get(seriesKeyOf(projectId)) ?? 0) + consumedUsd));
  const projectSeries = report.projects.map(project =>
    project.isDeleted
      ? { key: project.projectId, label: projectLabelOf(project) }
      : { key: project.projectId, label: projectLabelOf(project), onSelect: () => onSelect(project.projectId) }
  );

  return [...projectSeries, { key: UNASSIGNED_SERIES_KEY, label: UNASSIGNED_LABEL }]
    .filter(({ key }) => spendByKey.has(key))
    .sort((left, right) => spendByKey.get(right.key)! - spendByKey.get(left.key)!);
}

/** The api lists the biggest spender first, and each share is of the scope's total so a project's rows add up to all of it. */
export function deploymentRowsOf(report: DeploymentSpendReport, scope: ProjectScope): DeploymentSpendRow[] {
  const projectNames = new Map(report.projects.map(project => [project.projectId, projectLabelOf(project)]));
  const deployments = report.deployments.filter(({ projectId }) => isInScope(projectId, scope));
  const totalUsd = sumOf(deployments.map(({ consumedUsd }) => consumedUsd));

  return deployments.map(({ dseq, name, projectId, hours, consumedUsd }) => ({
    dseq,
    name,
    projectName: projectId === null ? UNASSIGNED_LABEL : projectNames.get(projectId) ?? UNKNOWN_PROJECT_LABEL,
    hours,
    hourlyRateUsd: hours > 0 ? consumedUsd / hours : 0,
    consumedUsd,
    sharePercent: totalUsd > 0 ? (consumedUsd / totalUsd) * 100 : 0
  }));
}

/** Each row takes the shade of its project's stack in the daily chart, and the biggest consumer comes first. */
export function projectSpendRowsOf(
  projectSpend: ProjectSpendReport,
  deploymentSpend: DeploymentSpendReport | undefined,
  onSelect: (projectId: string) => void
): ProjectSpendRow[] {
  const seriesKeys = deploymentSpend ? projectSeriesOf(deploymentSpend, onSelect).map(({ key }) => key) : [];
  const usageByKey = deploymentUsageByKeyOf(deploymentSpend?.deployments ?? []);
  const entries: Array<Pick<ProjectSpendRow, "key" | "label" | "onSelect"> & { amounts: SpendAmounts }> = projectSpend.projects.map(project => ({
    key: project.projectId,
    label: projectLabelOf(project),
    onSelect: project.isDeleted ? undefined : () => onSelect(project.projectId),
    amounts: project
  }));
  const unassigned = projectSpend.unassigned;
  if (unassigned && (unassigned.consumedUsd > 0 || unassigned.committedUsd > 0)) {
    entries.push({ key: UNASSIGNED_SERIES_KEY, label: UNASSIGNED_LABEL, amounts: unassigned });
  }
  const totalConsumedUsd = sumOf(entries.map(({ amounts }) => amounts.consumedUsd));

  return entries
    .map(({ amounts, ...entry }) => {
      const seriesIndex = seriesKeys.indexOf(entry.key);
      return {
        ...entry,
        deploymentCount: usageByKey.get(entry.key)?.deploymentCount ?? 0,
        hours: usageByKey.get(entry.key)?.hours ?? 0,
        consumedUsd: amounts.consumedUsd,
        committedUsd: amounts.committedUsd,
        sharePercent: totalConsumedUsd > 0 ? (amounts.consumedUsd / totalConsumedUsd) * 100 : 0,
        shade: seriesIndex === -1 ? null : spendShade(seriesIndex, seriesKeys.length)
      };
    })
    .sort((left, right) => right.consumedUsd - left.consumedUsd);
}

export function hourlyRateOf(perBlockUsdByDseq: Map<string, number>, dseqs: string[]): number {
  return perBlockToHourly(dseqs.reduce((total, dseq) => total + (perBlockUsdByDseq.get(dseq) ?? 0), 0));
}

function deploymentUsageByKeyOf(deployments: DeploymentSpendReport["deployments"]): Map<string, { deploymentCount: number; hours: number }> {
  const usageByKey = new Map<string, { deploymentCount: number; hours: number }>();
  deployments.forEach(({ projectId, hours }) => {
    const usage = usageByKey.get(seriesKeyOf(projectId)) ?? { deploymentCount: 0, hours: 0 };
    usageByKey.set(seriesKeyOf(projectId), { deploymentCount: usage.deploymentCount + 1, hours: usage.hours + hours });
  });

  return usageByKey;
}

function reportsGpuUsage(report: DeploymentSpendReport): boolean {
  return report.deployments.every(({ gpuHours }) => gpuHours !== undefined);
}

function gpuUsageOf(deployments: DeploymentSpend[]): Pick<UsageHistoryStats, "gpuHours" | "gpuModels"> {
  return {
    gpuHours: sumOf(deployments.map(({ gpuHours = 0 }) => gpuHours)),
    gpuModels: [...new Set(deployments.flatMap(({ gpuModels = [] }) => gpuModels))].sort((left, right) => left.localeCompare(right))
  };
}

function projectLabelOf({ name, isDeleted }: { name: string; isDeleted: boolean }): string {
  return isDeleted ? `${name} (deleted)` : name;
}

function seriesKeyOf(projectId: string | null): string {
  return projectId ?? UNASSIGNED_SERIES_KEY;
}

function sumOf(amounts: number[]): number {
  return amounts.reduce((total, amount) => total + amount, 0);
}

function datesOf({ startDate, endDate }: SpendRange): string[] {
  const dates: string[] = [];

  for (const day = new Date(`${startDate}T00:00:00.000Z`); day <= new Date(`${endDate}T00:00:00.000Z`); day.setUTCDate(day.getUTCDate() + 1)) {
    dates.push(day.toISOString().slice(0, 10));
  }

  return dates;
}

function roundToCents(amountUsd: number): number {
  return Math.round(amountUsd * 100) / 100;
}
