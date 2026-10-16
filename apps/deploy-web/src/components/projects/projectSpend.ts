import { canManageProjects } from "@src/components/organizations/organizationAccess";
import type { OrganizationRole } from "@src/types/organization";
import type { ProjectRole } from "@src/types/project";
import type { ProjectBudget, SpendRange } from "@src/types/project-budget";

/** Budgets count spend per UTC day, so the month runs from its first UTC day to today's, both included. */
export function thisMonthSpendRange(now: Date = new Date()): SpendRange {
  const today = now.toISOString().slice(0, 10);

  return { startDate: `${today.slice(0, 7)}-01`, endDate: today };
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
