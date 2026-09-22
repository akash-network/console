import { sql } from "drizzle-orm";
import { integer, jsonb, pgTable, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";

import { Users } from "@src/user/model-schemas";

/** What a card reported about itself, before any catalog lookup: the model is resolved on read so a grown alias table needs no backfill. */
export type DetectedGpuRecord = {
  rawName: string;
  pciDeviceId: string | null;
  memoryMb: number;
  count: number;
};

/** Which tool answered the probe; `none` is a container that ran it and had neither, which is a reading rather than a gap. */
export const GPU_PROBE_SOURCES = ["nvidia-smi", "rocm-smi", "none"] as const;

export type GpuProbeSource = (typeof GPU_PROBE_SOURCES)[number];

export const LeaseGpus = pgTable(
  "lease_gpus",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    userId: uuid("user_id")
      .references(() => Users.id, { onDelete: "cascade" })
      .notNull(),
    dseq: varchar("dseq").notNull(),
    gseq: integer("gseq").notNull(),
    oseq: integer("oseq").notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    service: varchar("service", { length: 255 }).notNull(),
    /** Empty for a container that answered without a GPU tool, which is what stops the sweep re-enqueuing it forever. */
    gpus: jsonb("gpus").$type<DetectedGpuRecord[]>().notNull(),
    driverVersion: varchar("driver_version", { length: 64 }),
    source: varchar("source", { length: 16 }).$type<GpuProbeSource>().notNull(),
    detectedAt: timestamp("detected_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    /** The probe upserts on this, so the newest reading replaces the last one, and its leading columns serve both the detail and the list read. */
    leaseServiceIdx: unique("lease_gpus_lease_service_idx").on(table.userId, table.dseq, table.gseq, table.oseq, table.provider, table.service)
  })
);
