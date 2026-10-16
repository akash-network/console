import { z } from "@hono/zod-openapi";

import { ListProjectSpendQuerySchema } from "@src/organization/http-schemas/project-spend.schema";

export const ListDeploymentSpendQuerySchema = ListProjectSpendQuerySchema;

const SpendProjectSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string(),
  isDefault: z.boolean(),
  isDeleted: z.boolean()
});

const DailyProjectSpendSchema = z.object({
  date: z.string().openapi({ description: "The UTC day (YYYY-MM-DD)", example: "2026-10-01" }),
  projectId: z.string().uuid().nullable().openapi({ description: "Null for the deployments filed in no project" }),
  consumedUsd: z.number().openapi({ description: "What the project's leases cost that day, including costs not settled yet" })
});

const DeploymentSpendSchema = z.object({
  dseq: z.string(),
  name: z.string().nullable(),
  projectId: z.string().uuid().nullable().openapi({ description: "Null for a deployment filed in no project" }),
  consumedUsd: z.number().openapi({ description: "What the deployment's leases cost over the range, including costs not settled yet" }),
  hours: z.number().openapi({ description: "How long the deployment held a lease over the range" })
});

export const ListDeploymentSpendResponseSchema = z.object({
  data: z.object({
    startDate: z.string(),
    endDate: z.string(),
    projects: z.array(SpendProjectSchema).openapi({ description: "The projects the caller can see, and deleted ones that have spend in the range" }),
    days: z.array(DailyProjectSpendSchema).openapi({ description: "Each project's spend per day, leaving out days it spent nothing" }),
    deployments: z.array(DeploymentSpendSchema).openapi({ description: "The deployments that held a lease in the range, most spent first" })
  })
});

export type ListDeploymentSpendQuery = z.infer<typeof ListDeploymentSpendQuerySchema>;
export type ListDeploymentSpendResponse = z.infer<typeof ListDeploymentSpendResponseSchema>;
