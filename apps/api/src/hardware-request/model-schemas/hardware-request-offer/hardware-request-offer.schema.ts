import { sql } from "drizzle-orm";
import { boolean, doublePrecision, index, jsonb, pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { HardwareRequests, type HardwareRequestSpec, type REQUEST_TERMS, type UPTIME_SLAS } from "../hardware-request/hardware-request.schema";

export const MAX_PROVIDER_ADDRESS_LENGTH = 64;
export const MAX_OFFER_LOCATION_LENGTH = 100;

export const hardwareRequestOfferStatusEnum = pgEnum("hardware_request_offer_status", ["draft", "published", "withdrawn", "accepted", "declined", "closed"]);

export type HardwareRequestOfferStatus = (typeof hardwareRequestOfferStatusEnum.enumValues)[number];

/** Mirrors the request's own spec field by field, so each value can be compared with what the tenant asked for. */
export type HardwareRequestOfferTerms = {
  gpu: { model: string; count: number; interconnect: HardwareRequestSpec["gpu"]["interconnect"] };
  location: string;
  availableFrom: string;
  term: (typeof REQUEST_TERMS)[number];
  sla: (typeof UPTIME_SLAS)[number] | null;
  storage: HardwareRequestSpec["storage"];
  uplinkGbps: HardwareRequestSpec["uplinkGbps"];
};

export const HardwareRequestOffers = pgTable(
  "hardware_request_offers",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    hardwareRequestId: uuid("hardware_request_id")
      .references(() => HardwareRequests.id, { onDelete: "cascade" })
      .notNull(),
    status: hardwareRequestOfferStatusEnum("status").notNull().default("draft"),
    providerAddress: varchar("provider_address", { length: MAX_PROVIDER_ADDRESS_LENGTH }).notNull(),
    providerAudited: boolean("provider_audited").notNull(),
    providerUptime7d: doublePrecision("provider_uptime_7d"),
    usdPerGpuHour: doublePrecision("usd_per_gpu_hour").notNull(),
    terms: jsonb("terms").$type<HardwareRequestOfferTerms>().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    hardwareRequestIdCreatedAtIdx: index("hardware_request_offers_hardware_request_id_created_at_idx").on(table.hardwareRequestId, table.createdAt)
  })
);
