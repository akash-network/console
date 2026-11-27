import type {
  DailyDeployCohort,
  DailyForkCount,
  DeployCohortCounts,
  VersionDeployCohort
} from "@src/template-marketplace/repositories/template-usage-event/template-usage-event.repository";
import type { DailyViewCount } from "@src/template-marketplace/repositories/template-view-event/template-view-event.repository";
import { findInsightHints, type InsightHint } from "./template-insight-hints";

export const INSIGHT_PERIODS = [7, 30, 90] as const;

export type InsightPeriodDays = (typeof INSIGHT_PERIODS)[number];

/** UTC days, both ends included; the previous period is as long and ends the day before this one starts. */
export type InsightWindow = { days: InsightPeriodDays; from: string; to: string; previousFrom: string };

export type InsightRates = { leaseRate: number | null; stillRunningRate: number | null; viewToDeployRate: number | null };

export type InsightTotals = DeployCohortCounts & { views: number; configureOpens: number; forks: number } & InsightRates;

export type DailyInsight = { day: string; views: number; configureOpens: number; deploys: number; leases: number; stillRunning: number };

export type VersionInsight = DeployCohortCounts & { version: number; leaseRate: number | null; stillRunningRate: number | null };

export type TemplateInsights = {
  days: InsightPeriodDays;
  from: string;
  to: string;
  current: InsightTotals;
  previous: InsightTotals;
  daily: DailyInsight[];
  versions: VersionInsight[];
  hints: InsightHint[];
};

export type InsightSources = {
  views: DailyViewCount[];
  deploys: DailyDeployCohort[];
  forks: DailyForkCount[];
  versions: VersionDeployCohort[];
};

/** Below these, one deployment or one visitor swings a rate too far for it to mean anything. */
export const MIN_DEPLOYS_FOR_LEASE_RATE = 5;
export const MIN_DECIDED_LEASES_FOR_STILL_RUNNING_RATE = 5;
export const MIN_VIEWS_FOR_DEPLOY_RATE = 20;

const DAY_MS = 24 * 60 * 60 * 1000;

const NO_COHORT: DeployCohortCounts = { deploys: 0, leases: 0, decidedLeases: 0, stillRunning: 0 };

export function insightWindowOf(now: Date, days: InsightPeriodDays): InsightWindow {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  return {
    days,
    from: utcDayAt(today - (days - 1) * DAY_MS),
    to: utcDayAt(today),
    previousFrom: utcDayAt(today - (2 * days - 1) * DAY_MS)
  };
}

export function buildTemplateInsights(window: InsightWindow, sources: InsightSources): TemplateInsights {
  const daily = daysBetween(window.previousFrom, window.to).map(day => dailyInsightOf(day, sources));
  const current = totalsOf(daily.filter(({ day }) => day >= window.from));
  const previous = totalsOf(daily.filter(({ day }) => day < window.from));
  const versions = sources.versions.map(versionInsightOf);

  return {
    days: window.days,
    from: window.from,
    to: window.to,
    current,
    previous,
    daily: daily.filter(({ day }) => day >= window.from).map(({ decidedLeases: _decidedLeases, forks: _forks, ...point }) => point),
    versions,
    hints: findInsightHints({ current, previous, versions })
  };
}

export function ratesOf({ views, deploys, leases, decidedLeases, stillRunning }: DeployCohortCounts & { views: number }): InsightRates {
  return {
    leaseRate: deploys >= MIN_DEPLOYS_FOR_LEASE_RATE ? leases / deploys : null,
    stillRunningRate: decidedLeases >= MIN_DECIDED_LEASES_FOR_STILL_RUNNING_RATE ? stillRunning / decidedLeases : null,
    viewToDeployRate: views >= MIN_VIEWS_FOR_DEPLOY_RATE ? Math.min(1, deploys / views) : null
  };
}

type DayCounts = DailyInsight & { decidedLeases: number; forks: number };

function dailyInsightOf(day: string, { views, deploys, forks }: InsightSources): DayCounts {
  const cohort = deploys.find(row => row.day === day) ?? NO_COHORT;

  return {
    day,
    views: viewersOn(views, day, "page_view"),
    configureOpens: viewersOn(views, day, "configure_open"),
    deploys: cohort.deploys,
    leases: cohort.leases,
    decidedLeases: cohort.decidedLeases,
    stillRunning: cohort.stillRunning,
    forks: forks.find(row => row.day === day)?.forks ?? 0
  };
}

function viewersOn(views: DailyViewCount[], day: string, kind: DailyViewCount["kind"]): number {
  return views.find(row => row.day === day && row.kind === kind)?.viewers ?? 0;
}

function totalsOf(days: DayCounts[]): InsightTotals {
  const sum = (pick: (day: DayCounts) => number) => days.reduce((total, day) => total + pick(day), 0);
  const counts = {
    views: sum(day => day.views),
    configureOpens: sum(day => day.configureOpens),
    deploys: sum(day => day.deploys),
    leases: sum(day => day.leases),
    decidedLeases: sum(day => day.decidedLeases),
    stillRunning: sum(day => day.stillRunning),
    forks: sum(day => day.forks)
  };

  return { ...counts, ...ratesOf(counts) };
}

function versionInsightOf(cohort: VersionDeployCohort): VersionInsight {
  const { leaseRate, stillRunningRate } = ratesOf({ ...cohort, views: 0 });

  return { ...cohort, leaseRate, stillRunningRate };
}

function daysBetween(from: string, to: string): string[] {
  const start = Date.parse(`${from}T00:00:00Z`);
  const count = Math.round((Date.parse(`${to}T00:00:00Z`) - start) / DAY_MS) + 1;

  return Array.from({ length: count }, (_, index) => utcDayAt(start + index * DAY_MS));
}

function utcDayAt(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}
