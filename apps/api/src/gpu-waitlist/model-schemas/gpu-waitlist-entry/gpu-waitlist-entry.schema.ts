import { sql } from "drizzle-orm";
import { index, integer, pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { Organizations } from "@src/organization/model-schemas/organization/organization.schema";
import { Users } from "@src/user/model-schemas";

export const MAX_GPU_FIELD_LENGTH = 100;
export const MAX_POOL_KEY_LENGTH = 320;

export const gpuWaitlistEntrySourceEnum = pgEnum("gpu_waitlist_entry_source", ["gpu_menu", "no_fit", "no_bids"]);

export type GpuWaitlistEntrySource = (typeof gpuWaitlistEntrySourceEnum.enumValues)[number];

export const gpuWaitlistEntryStatusEnum = pgEnum("gpu_waitlist_entry_status", ["waiting", "fulfilled", "left", "expired"]);

export type GpuWaitlistEntryStatus = (typeof gpuWaitlistEntryStatusEnum.enumValues)[number];

export const GpuWaitlistEntries = pgTable(
  "gpu_waitlist_entries",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    userId: uuid("user_id")
      .references(() => Users.id, { onDelete: "cascade" })
      .notNull(),
    organizationId: uuid("organization_id").references(() => Organizations.id, { onDelete: "cascade" }),
    vendor: varchar("vendor", { length: MAX_GPU_FIELD_LENGTH }).notNull(),
    model: varchar("model", { length: MAX_GPU_FIELD_LENGTH }).notNull(),
    memory: varchar("memory", { length: MAX_GPU_FIELD_LENGTH }),
    interface: varchar("interface", { length: MAX_GPU_FIELD_LENGTH }),
    poolKey: varchar("pool_key", { length: MAX_POOL_KEY_LENGTH }).notNull(),
    gpuCount: integer("gpu_count").notNull(),
    source: gpuWaitlistEntrySourceEnum("source").notNull(),
    status: gpuWaitlistEntryStatusEnum("status").notNull().default("waiting"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
    lastNotifiedAt: timestamp("last_notified_at", { withTimezone: true }),
    notifiedCount: integer("notified_count").notNull().default(0),
    stillWantedAskedAt: timestamp("still_wanted_asked_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    poolKeyStatusJoinedAtIdx: index("gpu_waitlist_entries_pool_key_status_joined_at_idx").on(table.poolKey, table.status, table.joinedAt),
    userIdStatusIdx: index("gpu_waitlist_entries_user_id_status_idx").on(table.userId, table.status)
  })
);
