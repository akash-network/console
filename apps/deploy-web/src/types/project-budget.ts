import type { operationDefs } from "@akashnetwork/console-api-types";

export type ProjectSpendReport = operationDefs["listProjectSpend"]["responses"][200]["content"]["application/json"]["data"];

export type ProjectSpend = ProjectSpendReport["projects"][number];

export type SpendAmounts = NonNullable<ProjectSpendReport["total"]>;

export type SpendRange = Pick<ProjectSpendReport, "startDate" | "endDate">;

export type ProjectBudget = operationDefs["listProjectBudgets"]["responses"][200]["content"]["application/json"]["data"][number];

export type ProjectBudgetSettings = Pick<ProjectBudget, "monthlyAmountUsd" | "alertThresholdPercent" | "stopTopUps">;

/** The `code` of the 403 a deployment create answers when its deposit would take the project past its monthly budget. */
export const PROJECT_BUDGET_EXCEEDED_ERROR_CODE = "project_budget_exceeded";

export const DEFAULT_ALERT_THRESHOLD_PERCENT = 80;

export const MIN_MONTHLY_BUDGET_USD = 1;

export const MAX_MONTHLY_BUDGET_USD = 10_000_000;
