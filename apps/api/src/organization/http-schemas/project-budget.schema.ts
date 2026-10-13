import { z } from "@hono/zod-openapi";

import { DEFAULT_ALERT_THRESHOLD_PERCENT } from "@src/organization/model-schemas/project-budget/project-budget.schema";

export const MIN_MONTHLY_BUDGET_USD = 1;
export const MAX_MONTHLY_BUDGET_USD = 10_000_000;

const MonthlyAmountUsdSchema = z
  .number()
  .min(MIN_MONTHLY_BUDGET_USD)
  .max(MAX_MONTHLY_BUDGET_USD)
  .multipleOf(0.01)
  .openapi({
    description: `Committed spend allowed per calendar month (UTC), in USD (${MIN_MONTHLY_BUDGET_USD} to ${MAX_MONTHLY_BUDGET_USD}, cents at most)`
  });

const AlertThresholdPercentSchema = z
  .number()
  .int()
  .min(1)
  .max(100)
  .openapi({
    description: `Share of the monthly amount at which owners and admins are notified, once per month. Defaults to ${DEFAULT_ALERT_THRESHOLD_PERCENT}`
  });

const StopTopUpsSchema = z.boolean().openapi({
  description: "Whether top-ups of the project's running deployments, manual or automatic, also stop at the budget. Defaults to false"
});

export const ProjectBudgetParamsSchema = z.object({ id: z.string().uuid() });

export const ListProjectBudgetsQuerySchema = z.object({
  projectId: z.string().uuid().optional().openapi({ description: "Only the budget of this project" })
});

export const CreateProjectBudgetRequestSchema = z.object({
  data: z.object({
    projectId: z.string().uuid(),
    monthlyAmountUsd: MonthlyAmountUsdSchema,
    alertThresholdPercent: AlertThresholdPercentSchema.optional(),
    stopTopUps: StopTopUpsSchema.optional()
  })
});

export const UpdateProjectBudgetRequestSchema = z.object({
  data: z.object({
    monthlyAmountUsd: MonthlyAmountUsdSchema.optional(),
    alertThresholdPercent: AlertThresholdPercentSchema.optional(),
    stopTopUps: StopTopUpsSchema.optional()
  })
});

const ProjectBudgetSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  monthlyAmountUsd: z.number(),
  alertThresholdPercent: z.number(),
  stopTopUps: z.boolean(),
  currentPeriod: z.object({
    startDate: z.string().openapi({ description: "First day of the current calendar month (UTC)" }),
    endDate: z.string().openapi({ description: "Last day of the current calendar month (UTC)" }),
    committedUsd: z.number().openapi({ description: "Deposits recorded for the project this month, the figure new deposits are judged against" })
  }),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const ProjectBudgetResponseSchema = z.object({ data: ProjectBudgetSchema });

export const ListProjectBudgetsResponseSchema = z.object({ data: z.array(ProjectBudgetSchema) });

export type CreateProjectBudgetRequest = z.infer<typeof CreateProjectBudgetRequestSchema>;
export type UpdateProjectBudgetRequest = z.infer<typeof UpdateProjectBudgetRequestSchema>;
export type ProjectBudgetResponseItem = z.infer<typeof ProjectBudgetSchema>;
export type ProjectBudgetResponse = z.infer<typeof ProjectBudgetResponseSchema>;
export type ListProjectBudgetsResponse = z.infer<typeof ListProjectBudgetsResponseSchema>;
