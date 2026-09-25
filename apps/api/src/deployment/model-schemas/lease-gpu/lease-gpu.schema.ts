import { sql } from "drizzle-orm";
import { integer, jsonb, pgTable, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";

import type { DetectedGpuRecord, GpuProbeSource } from "@src/deployment/model-schemas/deployment-setting/deployment-setting.schema";
import { Users } from "@src/user/model-schemas";

/** Superseded by `deployment_settings.detected_gpus` and kept only until a release that no longer writes here has shipped. */
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
    gpus: jsonb("gpus").$type<DetectedGpuRecord[]>().notNull(),
    driverVersion: varchar("driver_version", { length: 64 }),
    source: varchar("source", { length: 16 }).$type<GpuProbeSource>().notNull(),
    detectedAt: timestamp("detected_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    leaseServiceIdx: unique("lease_gpus_lease_service_idx").on(table.userId, table.dseq, table.gseq, table.oseq, table.provider, table.service)
  })
);
