import { z } from "@hono/zod-openapi";

import { AkashAddressSchema } from "@src/utils/schema";

const DEFAULT_USAGE_WINDOW_DAYS = 30;
const MAX_USAGE_WINDOW_DAYS = 366;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toIsoDate(date: Date) {
  return date.toISOString().split("T")[0];
}

function startOfInclusiveWindow(endDate: string, windowDays: number) {
  const date = new Date(`${endDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - (windowDays - 1));
  return toIsoDate(date);
}

function countInclusiveDays(startDate: string, endDate: string) {
  return (Date.parse(endDate) - Date.parse(startDate)) / MS_PER_DAY + 1;
}

export const GetUsageHistoryQuerySchema = z
  .object({
    address: AkashAddressSchema.openapi({
      description: "The wallet address to get billing and usage data for",
      example: "akash18andxgtd6r08zzfpcdqg9pdr6smks7gv76tyt6"
    }),
    startDate: z
      .string()
      .date()
      .optional()
      .openapi({
        description: `Start date (YYYY-MM-DD), inclusive. Defaults to a ${DEFAULT_USAGE_WINDOW_DAYS}-day window ending at endDate`,
        example: "2024-01-01"
      }),
    endDate: z.string().date().optional().openapi({
      description: "End date (YYYY-MM-DD), inclusive. Defaults to today (UTC)",
      example: "2024-01-31"
    })
  })
  .transform(data => {
    const endDate = data.endDate ?? toIsoDate(new Date());
    const startDate = data.startDate ?? startOfInclusiveWindow(endDate, DEFAULT_USAGE_WINDOW_DAYS);

    return { ...data, startDate, endDate };
  })
  .refine(
    data => {
      const windowDays = countInclusiveDays(data.startDate, data.endDate);

      return windowDays >= 1 && windowDays <= MAX_USAGE_WINDOW_DAYS;
    },
    {
      message: `Date range cannot exceed ${MAX_USAGE_WINDOW_DAYS} days and startDate must not be after endDate`
    }
  );

export const UsageHistoryResponseSchema = z.array(
  z.object({
    date: z.string().openapi({
      description: "Date in YYYY-MM-DD format",
      example: "2024-01-15"
    }),
    activeDeployments: z.number().openapi({
      description: "Number of active deployments on this date",
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
    dailyActSpent: z.number().openapi({
      description: "ACT spent on this date (includes legacy USDC)",
      example: 5.25
    }),
    totalActSpent: z.number().openapi({
      description: "Cumulative ACT spent up to this date (includes legacy USDC)",
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
