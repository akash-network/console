import { z } from "@hono/zod-openapi";

import { AkashAddressSchema } from "@src/utils/schema";

export const GetUsageHistoryQuerySchema = z
  .object({
    address: AkashAddressSchema.openapi({
      description: "The wallet address to get billing and usage data for",
      example: "akash18andxgtd6r08zzfpcdqg9pdr6smks7gv76tyt6"
    }),
    startDate: z.string().date().optional().openapi({
      description: "Start date (YYYY-MM-DD). Defaults to 30 days before endDate",
      example: "2024-01-01"
    }),
    endDate: z
      .string()
      .date()
      .default(() => new Date().toISOString().split("T")[0])
      .openapi({
        description: "End date (YYYY-MM-DD). Defaults to today by UTC 23:59:59",
        example: "2024-01-31"
      })
  })
  .transform(data => {
    if (data.startDate) {
      return data;
    }

    const endDate = new Date(data.endDate);
    endDate.setDate(endDate.getDate() - 30);

    return { ...data, startDate: endDate.toISOString().split("T")[0] };
  })
  .refine(
    data => {
      const end = new Date(data.endDate!);
      const start = new Date(data.startDate!);

      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));

      return start <= end && daysDiff <= 366;
    },
    {
      message: "Date range cannot exceed 366 days and startDate must be before endDate"
    }
  );

export const UsageHistoryResponseSchema = z.array(
  z.object({
    date: z.string().openapi({
      description: "Date in YYYY-MM-DD format",
      example: "2024-01-15"
    }),
    activeDeployments: z.number().openapi({
      description: "Number of active leases on this date",
      example: 3
    }),
    dailyAktSpent: z.number().openapi({
      description: "AKT tokens spent on this date",
      example: 12.5
    }),
    totalAktSpent: z.number().openapi({
      description: "Cumulative AKT tokens spent up to this date",
      example: 125.75
    }),
    dailyUsdcSpent: z.number().openapi({
      description: "USDC spent on this date",
      example: 5.25
    }),
    totalUsdcSpent: z.number().openapi({
      description: "Cumulative USDC spent up to this date",
      example: 52.5
    }),
    dailyUsdSpent: z.number().openapi({
      description: "Total USD value spent on this date (AKT + USDC)",
      example: 17.75
    }),
    totalUsdSpent: z.number().openapi({
      description: "Cumulative USD value spent up to this date",
      example: 178.25
    })
  })
);

export const UsageHistoryStatsResponseSchema = z.object({
  totalSpent: z.number().openapi({
    description: "Total amount spent in USD",
    example: 1234.56
  }),
  averageSpentPerDay: z.number().openapi({
    description: "Average spending per day in USD",
    example: 12.34
  }),
  totalDeployments: z.number().openapi({
    description: "Total number of deployments deployed",
    example: 15
  }),
  averageDeploymentsPerDay: z.number().openapi({
    description: "Average number of deployments deployed per day",
    example: 1.5
  })
});

export type UsageHistoryResponse = z.infer<typeof UsageHistoryResponseSchema>;
export type UsageHistoryStats = z.infer<typeof UsageHistoryStatsResponseSchema>;
