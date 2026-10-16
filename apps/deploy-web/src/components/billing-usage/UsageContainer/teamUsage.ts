import type { DailySpend } from "@src/components/billing-usage/DailySpendChart/DailySpendChart";
import type { UsageHistoryStats } from "@src/types";
import type { DeploymentSpendReport } from "@src/types/deployment-spend";
import type { SpendRange } from "@src/types/project-budget";
import { perBlockToHourly } from "@src/utils/priceUtils";

/** Null for the whole organization, or the id of the one project the page is narrowed to. */
export type ProjectScope = string | null;

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
  const spendByDate = new Map<string, number>();
  report.days
    .filter(({ projectId }) => isInScope(projectId, scope))
    .forEach(({ date, consumedUsd }) => spendByDate.set(date, (spendByDate.get(date) ?? 0) + consumedUsd));
  const dailySpend = datesOf(report).map(date => ({ date, dailyUsdSpent: roundToCents(spendByDate.get(date) ?? 0) }));
  const dseqs = report.deployments.filter(({ projectId }) => isInScope(projectId, scope)).map(({ dseq }) => dseq);
  const totalSpent = roundToCents(dailySpend.reduce((total, { dailyUsdSpent }) => total + dailyUsdSpent, 0));

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

export function hourlyRateOf(perBlockUsdByDseq: Map<string, number>, dseqs: string[]): number {
  return perBlockToHourly(dseqs.reduce((total, dseq) => total + (perBlockUsdByDseq.get(dseq) ?? 0), 0));
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
