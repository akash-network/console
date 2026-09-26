import { z } from "@hono/zod-openapi";

const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;

export const GetNetworkStatsQuerySchema = z.object({
  days: z.coerce.number().int().min(0).max(MAX_DAYS).optional().default(DEFAULT_DAYS).openapi({
    description: "Number of most recent closed UTC days to include",
    example: DEFAULT_DAYS,
    default: DEFAULT_DAYS,
    maximum: MAX_DAYS
  })
});

const ActiveResourcesSchema = z.object({
  cpuUnits: z.number(),
  gpuUnits: z.number(),
  memoryBytes: z.number(),
  ephemeralStorageBytes: z.number(),
  persistentStorageBytes: z.number()
});

/** Spend totals are exact 18-decimal amounts in u-denoms, so they travel as strings. */
const SpentByDenomSchema = z.object({
  uakt: z.string(),
  uusdc: z.string(),
  uact: z.string()
});

export const NetworkDaySchema = z.object({
  date: z.string(),
  closeHeight: z.number(),
  activeLeaseCount: z.number(),
  totalLeaseCount: z.number(),
  dailyLeaseCount: z.number(),
  activeProviderCount: z.number(),
  active: ActiveResourcesSchema,
  totalSpent: SpentByDenomSchema,
  dailySpent: SpentByDenomSchema,
  dailyUsdSpent: z.string().nullable(),
  totalUsdSpent: z.string().openapi({
    description: "Cumulative USD spend through this day's close; a day without an AKT price counts its stablecoin spend only"
  })
});

export const GetNetworkStatsResponseSchema = z.object({
  data: z.object({
    height: z.number(),
    datetime: z.string(),
    activeLeaseCount: z.number(),
    totalLeaseCount: z.number(),
    activeProviderCount: z.number(),
    active: ActiveResourcesSchema,
    totalSpent: SpentByDenomSchema,
    totalUsdSpent: z.string().openapi({
      description: "Cumulative USD spend as of the aggregation height: the closed days plus the open day priced at its own AKT close"
    }),
    daily: z.array(NetworkDaySchema)
  })
});

export type GetNetworkStatsQuery = z.infer<typeof GetNetworkStatsQuerySchema>;
export type GetNetworkStatsResponse = z.infer<typeof GetNetworkStatsResponseSchema>;
export type NetworkDay = z.infer<typeof NetworkDaySchema>;
