import { z } from "@hono/zod-openapi";

import { REGION_AREAS } from "@src/hardware-request/model-schemas/hardware-request/hardware-request.schema";
import { GPU_MARKET_PRICE_SOURCES } from "../model-schemas";

export const GpuMarketQuerySchema = z.object({
  vendor: z.string().trim().min(1).optional(),
  model: z.string().trim().min(1).optional()
});

const UsdPerGpuHourSchema = z.number().nullable().openapi({ description: "Null when too few providers or samples back the range" });

const GpuMarketPriceSchema = z.object({
  vendor: z.string(),
  model: z.string(),
  ram: z.string().nullable(),
  interface: z.string().nullable(),
  area: z.enum(REGION_AREAS).nullable().openapi({ description: "Null for the range across every region" }),
  source: z.enum(GPU_MARKET_PRICE_SOURCES),
  lowUsdPerGpuHour: UsdPerGpuHourSchema,
  medianUsdPerGpuHour: UsdPerGpuHourSchema,
  highUsdPerGpuHour: UsdPerGpuHourSchema,
  sampleCount: z.number().int(),
  providerCount: z.number().int(),
  newestSampleAt: z.string().datetime(),
  windowDays: z.number().int(),
  computedAt: z.string().datetime()
});

export const GpuMarketPricesResponseSchema = z.object({ data: z.array(GpuMarketPriceSchema) });

const GpuSupplyProviderSchema = z.object({
  owner: z.string(),
  hostUri: z.string(),
  region: z.string().nullable(),
  area: z.enum(REGION_AREAS).nullable(),
  allocatable: z.number().int(),
  available: z.number().int(),
  bestBid: z.object({
    usdPerGpuHour: z.number().openapi({ description: "All-in hourly price of the provider's most relevant recent single-gpu bid" }),
    placedAt: z.string().datetime()
  })
});

const GpuSupplySchema = z.object({
  vendor: z.string(),
  model: z.string(),
  ram: z.string(),
  interface: z.string(),
  allocatable: z.number().int(),
  available: z.number().int(),
  providers: z.array(GpuSupplyProviderSchema).openapi({ description: "Only providers that placed a real bid on this gpu in the last 31 days" })
});

export const GpuSupplyResponseSchema = z.object({ data: z.array(GpuSupplySchema) });

export type GpuMarketQuery = z.infer<typeof GpuMarketQuerySchema>;
export type GpuMarketPricesResponse = z.infer<typeof GpuMarketPricesResponseSchema>;
export type GpuSupplyResponse = z.infer<typeof GpuSupplyResponseSchema>;
