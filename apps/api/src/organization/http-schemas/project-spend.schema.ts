import { z } from "@hono/zod-openapi";

const MAX_SPEND_RANGE_DAYS = 366;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toIsoDate(date: Date) {
  return date.toISOString().split("T")[0];
}

function firstDayOfMonth(date: string) {
  return `${date.slice(0, 7)}-01`;
}

function countInclusiveDays(startDate: string, endDate: string) {
  return (Date.parse(endDate) - Date.parse(startDate)) / MS_PER_DAY + 1;
}

export const ListProjectSpendQuerySchema = z
  .object({
    startDate: z.string().date().optional().openapi({
      description: "First day of the range (YYYY-MM-DD, UTC), inclusive. Defaults to the first day of endDate's month",
      example: "2026-10-01"
    }),
    endDate: z.string().date().optional().openapi({
      description: "Last day of the range (YYYY-MM-DD, UTC), inclusive. Defaults to today",
      example: "2026-10-31"
    })
  })
  .transform(query => {
    const endDate = query.endDate ?? toIsoDate(new Date());

    return { startDate: query.startDate ?? firstDayOfMonth(endDate), endDate };
  })
  .refine(
    ({ startDate, endDate }) => {
      const days = countInclusiveDays(startDate, endDate);

      return days >= 1 && days <= MAX_SPEND_RANGE_DAYS;
    },
    { message: `startDate must not be after endDate and the range cannot exceed ${MAX_SPEND_RANGE_DAYS} days` }
  );

const SpendAmountsSchema = z.object({
  committedUsd: z.number().openapi({ description: "Deposits signed for the deployments in the range, including ones not yet final" }),
  consumedUsd: z.number().openapi({ description: "What the deployments' leases cost over the range, including `estimatedConsumedUsd`" }),
  estimatedConsumedUsd: z.number().openapi({ description: "Part of `consumedUsd` accrued since the deployment was last settled, an estimate until it is" })
});

const ProjectSpendSchema = SpendAmountsSchema.extend({
  projectId: z.string().uuid(),
  name: z.string(),
  isDefault: z.boolean(),
  isDeleted: z.boolean()
});

export const ListProjectSpendResponseSchema = z.object({
  data: z.object({
    startDate: z.string(),
    endDate: z.string(),
    isEstimated: z.boolean().openapi({ description: "Whether any figure includes an estimate" }),
    projects: z.array(ProjectSpendSchema),
    unassigned: SpendAmountsSchema.nullable().openapi({
      description: "Spend of the organization's deployments filed in no project. Null for a caller limited to some projects"
    }),
    total: SpendAmountsSchema.nullable().openapi({
      description: "The organization's whole spend, the projects plus `unassigned`. Null for a caller limited to some projects"
    })
  })
});

export type ListProjectSpendQuery = z.infer<typeof ListProjectSpendQuerySchema>;
export type ListProjectSpendResponse = z.infer<typeof ListProjectSpendResponseSchema>;
export type SpendAmountsResponse = z.infer<typeof SpendAmountsSchema>;
