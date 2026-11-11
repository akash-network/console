import { z } from "@hono/zod-openapi";

import { REGION_AREAS } from "@src/hardware-request/model-schemas/hardware-request/hardware-request.schema";

export const DEFAULT_UNMET_DEMAND_DAYS = 30;
export const MAX_UNMET_DEMAND_DAYS = 90;

export const UnmetDemandQuerySchema = z.object({
  days: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_UNMET_DEMAND_DAYS)
    .default(DEFAULT_UNMET_DEMAND_DAYS)
    .openapi({ description: "How many days back the window reaches", example: DEFAULT_UNMET_DEMAND_DAYS })
});

const MedianBySourceSchema = z.object({ bid: z.number().nullable(), lease: z.number().nullable() });

const UnmetDemandRowSchema = z.object({
  vendor: z.string().nullable(),
  model: z.string().nullable().openapi({ description: "Null when the ask accepted any model" }),
  regionArea: z.enum(REGION_AREAS).nullable().openapi({ description: "Null when the ask pinned no region" }),
  noFit: z.number().int().openapi({ description: "Screenings that found no provider although some provider has the model" }),
  missingGpu: z.number().int().openapi({ description: "Screenings for a model no online provider has" }),
  zeroBid: z.number().int().openapi({ description: "Gpu deployment groups that drew no bid" }),
  totalUnmet: z.number().int(),
  gpusAsked: z.number().int(),
  hardwareRequests: z.number().int().nullable().openapi({ description: "Hardware requests for the model in the window, null for any model" }),
  supply: z
    .object({
      allocatable: z.number().int(),
      available: z.number().int(),
      biddingProviders: z.number().int().openapi({ description: "Providers that placed a real bid on the model in the last 31 days" }),
      biddingProvidersInArea: z.number().int().nullable()
    })
    .nullable()
    .openapi({ description: "Null for any model, or when live supply cannot be read" }),
  marketMedianUsdPerGpuHour: z
    .object({ allRegions: MedianBySourceSchema, area: MedianBySourceSchema.nullable() })
    .nullable()
    .openapi({ description: "Median of the model's most sampled variant; a null price means too few samples" })
});

export const UnmetDemandResponseSchema = z.object({
  since: z.string().datetime(),
  data: z.array(UnmetDemandRowSchema)
});

export type UnmetDemandQuery = z.infer<typeof UnmetDemandQuerySchema>;
export type UnmetDemandResponse = z.infer<typeof UnmetDemandResponseSchema>;
