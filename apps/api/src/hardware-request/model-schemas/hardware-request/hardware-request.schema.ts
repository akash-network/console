import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { Organizations } from "@src/organization/model-schemas/organization/organization.schema";
import { Users } from "@src/user/model-schemas";

export const MAX_GPU_MODEL_LENGTH = 100;
export const MAX_REGION_LENGTH = 100;
export const MAX_CONTACT_EMAIL_LENGTH = 255;

export const hardwareRequestCategoryEnum = pgEnum("hardware_request_category", ["gpu_model", "capacity", "region", "other", "quote"]);

export type HardwareRequestCategory = (typeof hardwareRequestCategoryEnum.enumValues)[number];

export const hardwareRequestStatusEnum = pgEnum("hardware_request_status", [
  "submitted",
  "in_review",
  "sourcing",
  "offers",
  "accepted",
  "fulfilled",
  "withdrawn",
  "closed"
]);

export type HardwareRequestStatus = (typeof hardwareRequestStatusEnum.enumValues)[number];

export const hardwareRequestSourceEnum = pgEnum("hardware_request_source", [
  "reserve_capacity",
  "configure_reserve",
  "no_fit",
  "no_bids",
  "gpu_menu",
  "requests_page"
]);

export type HardwareRequestSource = (typeof hardwareRequestSourceEnum.enumValues)[number];

export const HARDWARE_REQUEST_LANES = ["sales", "automated"] as const;

export type HardwareRequestLane = (typeof HARDWARE_REQUEST_LANES)[number];

export const SALES_LANE_REASONS = ["monthly_value", "multi_node", "interconnect", "long_term_data_center", "could_grow", "wants_to_talk"] as const;

export type SalesLaneReason = (typeof SALES_LANE_REASONS)[number];

export type HardwareRequestLaneReason = SalesLaneReason | "no_payment_method" | "below_thresholds" | "manual";

const MAX_LANE_REASON_LENGTH = 32;
const MAX_OWNER_LENGTH = 64;

export const hardwareRequestLaneEnum = pgEnum("hardware_request_lane", HARDWARE_REQUEST_LANES);

export type HardwareRequestConfiguration = {
  summary: string;
  cpu: number;
  memoryBytes: number;
  storageBytes: number;
  region: string | null;
  gpu?: { count: number; models: string[] };
};

export const REGION_AREAS = ["us", "ca", "eu", "uk", "apac", "me", "latam"] as const;
export const REQUEST_TERMS = ["month_to_month", "3_months", "6_months", "12_months", "24_months"] as const;
export const UPTIME_SLAS = ["99", "99.5", "99.9"] as const;

export type HardwareRequestSpec = {
  gpu: {
    model: string;
    count: number;
    interconnect: "none" | "server" | "cluster";
    fabric?: "any" | "infiniband" | "roce";
    fabricGbps?: 200 | 400 | 800;
  };
  region: { mode: "any" | "only" | "except"; areas: (typeof REGION_AREAS)[number][] };
  uplinkGbps: 1 | 10 | 25 | null;
  storage: { tbPerNode: number; nvme: boolean };
  sla: (typeof UPTIME_SLAS)[number] | null;
  targetPrice: { minUsdPerGpuHour?: number; maxUsdPerGpuHour?: number } | null;
  term: (typeof REQUEST_TERMS)[number];
  start: { kind: "asap" | "flexible" } | { kind: "date"; date: string };
  couldGrow: boolean;
  wantsToTalk: boolean;
  company?: string;
  phone?: string;
};

export const HardwareRequests = pgTable(
  "hardware_requests",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    userId: uuid("user_id").references(() => Users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(() => Organizations.id, { onDelete: "cascade" }),
    category: hardwareRequestCategoryEnum("category").notNull(),
    status: hardwareRequestStatusEnum("status").notNull().default("submitted"),
    source: hardwareRequestSourceEnum("source"),
    gpuModel: varchar("gpu_model", { length: MAX_GPU_MODEL_LENGTH }),
    quantity: integer("quantity"),
    region: varchar("region", { length: MAX_REGION_LENGTH }),
    details: text("details"),
    contactEmail: varchar("contact_email", { length: MAX_CONTACT_EMAIL_LENGTH }).notNull(),
    configuration: jsonb("configuration").$type<HardwareRequestConfiguration>(),
    spec: jsonb("spec").$type<HardwareRequestSpec>(),
    lane: hardwareRequestLaneEnum("lane"),
    laneReason: varchar("lane_reason", { length: MAX_LANE_REASON_LENGTH }).$type<HardwareRequestLaneReason>(),
    estimatedMonthlyUsd: integer("estimated_monthly_usd"),
    owner: varchar("owner", { length: MAX_OWNER_LENGTH }),
    firstRepliedAt: timestamp("first_replied_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    userIdCreatedAtIdx: index("hardware_requests_user_id_created_at_idx").on(table.userId, table.createdAt),
    organizationIdCreatedAtIdx: index("hardware_requests_organization_id_created_at_idx").on(table.organizationId, table.createdAt),
    unclaimedContactEmailIdx: index("hardware_requests_unclaimed_contact_email_idx")
      .on(sql`lower(${table.contactEmail})`)
      .where(sql`${table.userId} IS NULL`)
  })
);
