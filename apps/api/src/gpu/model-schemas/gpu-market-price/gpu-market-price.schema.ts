import { sql } from "drizzle-orm";
import { doublePrecision, index, integer, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import type { RegionArea } from "@src/gpu/lib/region-area/region-area";

export const GPU_MARKET_PRICE_SOURCES = ["bid", "lease"] as const;

export type GpuMarketPriceSource = (typeof GPU_MARKET_PRICE_SOURCES)[number];

/** The latest market price range per gpu variant, region area and source; a null area spans every region, and null prices mean too few samples. */
export const GpuMarketPrices = pgTable(
  "gpu_market_prices",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    vendor: varchar("vendor", { length: 64 }).notNull(),
    model: varchar("model", { length: 255 }).notNull(),
    ram: varchar("ram", { length: 32 }),
    interface: varchar("interface", { length: 32 }),
    area: varchar("area", { length: 16 }).$type<RegionArea>(),
    source: varchar("source", { length: 16 }).$type<GpuMarketPriceSource>().notNull(),
    lowUsdPerGpuHour: doublePrecision("low_usd_per_gpu_hour"),
    medianUsdPerGpuHour: doublePrecision("median_usd_per_gpu_hour"),
    highUsdPerGpuHour: doublePrecision("high_usd_per_gpu_hour"),
    sampleCount: integer("sample_count").notNull(),
    providerCount: integer("provider_count").notNull(),
    newestSampleAt: timestamp("newest_sample_at", { withTimezone: true }).notNull(),
    windowDays: integer("window_days").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull()
  },
  table => ({
    vendorModelIdx: index("gpu_market_prices_vendor_model_idx").on(table.vendor, table.model)
  })
);
