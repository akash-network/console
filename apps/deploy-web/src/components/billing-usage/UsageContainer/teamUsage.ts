import type { DailySpend, SpendSeries } from "@src/components/billing-usage/DailySpendChart/DailySpendChart";
import type { UsageHistoryStats } from "@src/types";
import type { DeploymentSpendReport } from "@src/types/deployment-spend";
import type { SpendRange } from "@src/types/project-budget";
import { perBlockToHourly } from "@src/utils/priceUtils";

/** Null for the whole organization, or the id of the one project the page is narrowed to. */
export type ProjectScope = string | null;

/** Project ids are uuids, so the deployments filed in no project get a key no project can take. */
const UNASSIGNED_SERIES_KEY = "unassigned";

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
  const dseqs = report.deployments.filter(({ projectId }) => isInScope(projectId, scope)).map(({ dseq }) => dseq);
  const totalSpent = roundToCents(sumOf(dailySpend.map(({ dailyUsdSpent }) => dailyUsdSpent)));

  return {
    dailySpend,
    stats: {
      totalSpent,
      averageSpentPerDay: totalSpent / dailySpend.length,
      totalDeployments: dseqs.length,
      averageDeploymentsPerDay: dseqs.length / dailySpend.length
    },
    dseqs
  };
}

/** The biggest spender of the range comes first and so gets the darkest shade, as in the spend by project rows. */
export function projectSeriesOf(report: DeploymentSpendReport, onSelect: (projectId: string) => void): SpendSeries[] {
  const spendByKey = new Map<string, number>();
  report.days.forEach(({ projectId, consumedUsd }) => spendByKey.set(seriesKeyOf(projectId), (spendByKey.get(seriesKeyOf(projectId)) ?? 0) + consumedUsd));
  const projectSeries = report.projects.map(({ projectId, name, isDeleted }) =>
    isDeleted ? { key: projectId, label: `${name} (deleted)` } : { key: projectId, label: name, onSelect: () => onSelect(projectId) }
  );

  return [...projectSeries, { key: UNASSIGNED_SERIES_KEY, label: "Unassigned" }]
    .filter(({ key }) => spendByKey.has(key))
    .sort((left, right) => spendByKey.get(right.key)! - spendByKey.get(left.key)!);
}

export function hourlyRateOf(perBlockUsdByDseq: Map<string, number>, dseqs: string[]): number {
  return perBlockToHourly(dseqs.reduce((total, dseq) => total + (perBlockUsdByDseq.get(dseq) ?? 0), 0));
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
