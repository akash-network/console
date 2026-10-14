import { canManageProjects } from "@src/components/organizations/organizationAccess";
import type { OrganizationRole } from "@src/types/organization";
import type { ProjectRole } from "@src/types/project";
import type { ProjectBudget, SpendRange } from "@src/types/project-budget";

export const SPEND_RANGE_PRESETS = ["this-month", "last-month", "last-30-days", "last-90-days"] as const;

export type SpendRangePreset = (typeof SPEND_RANGE_PRESETS)[number];

export const SPEND_RANGE_LABELS: Record<SpendRangePreset, string> = {
  "this-month": "This month",
  "last-month": "Last month",
  "last-30-days": "Last 30 days",
  "last-90-days": "Last 90 days"
};

const TRAILING_RANGE_DAYS: Partial<Record<SpendRangePreset, number>> = { "last-30-days": 30, "last-90-days": 90 };

/** Spend is reported per UTC day with both ends included, so every range is built from UTC calendar dates. */
export function spendRangeFor(preset: SpendRangePreset, now: Date = new Date()): SpendRange {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const today = now.getUTCDate();

  if (preset === "last-month") return { startDate: utcDate(year, month - 1, 1), endDate: utcDate(year, month, 0) };

  const trailingDays = TRAILING_RANGE_DAYS[preset];
  const startDate = trailingDays ? utcDate(year, month, today - trailingDays + 1) : utcDate(year, month, 1);

  return { startDate, endDate: utcDate(year, month, today) };
}

function utcDate(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function formatSpendUsd(amountUsd: number): string {
  return USD.format(amountUsd);
}

export interface BudgetAccess {
  /** Owners and admins set, change and remove budgets. */
  canManage: boolean;
  /** Who the api shows the budget to: billing for every project, and a member for the projects it administers. */
  canRead: boolean;
}

export function budgetAccessFor(organizationRole: OrganizationRole | undefined, projectRole: ProjectRole | undefined): BudgetAccess {
  const canManage = !!organizationRole && canManageProjects(organizationRole);
  const canRead = canManage || organizationRole === "billing" || (organizationRole === "member" && projectRole === "admin");

  return { canManage, canRead };
}

export type BudgetStanding = "within" | "past-alert" | "reached";

/** Deposits are refused only past the amount, so a month that lands exactly on it has reached the budget without going over. */
export function budgetStandingOf({ monthlyAmountUsd, alertThresholdPercent, currentPeriod }: ProjectBudget): BudgetStanding {
  if (currentPeriod.committedUsd >= monthlyAmountUsd) return "reached";
  if (currentPeriod.committedUsd * 100 >= monthlyAmountUsd * alertThresholdPercent) return "past-alert";
  return "within";
}

/** Unclamped, so a month past its budget reads above 100. */
export function budgetUsedPercent({ monthlyAmountUsd, currentPeriod }: ProjectBudget): number {
  return (currentPeriod.committedUsd / monthlyAmountUsd) * 100;
}
