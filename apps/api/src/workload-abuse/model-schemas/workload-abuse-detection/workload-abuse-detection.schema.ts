import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { Users } from "@src/user/model-schemas";
import type { DetectionSignal } from "@src/workload-abuse/lib/evidence-scanner/evidence-scanner";

export const workloadAbuseVerdictEnum = pgEnum("workload_abuse_verdict", ["hard", "soft", "proxy"]);

export const workloadAbuseActionEnum = pgEnum("workload_abuse_action", ["detected", "enforcing", "enforced", "enforcement_failed"]);

export const WorkloadAbuseDetections = pgTable(
  "workload_abuse_detections",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    userId: uuid("user_id")
      .references(() => Users.id, { onDelete: "cascade" })
      .notNull(),
    walletId: integer("wallet_id").notNull(),
    dseq: varchar("dseq").notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    verdict: workloadAbuseVerdictEnum("verdict").notNull(),
    probeStatus: varchar("probe_status", { length: 64 }).notNull(),
    signals: jsonb("signals").$type<DetectionSignal[]>().notNull(),
    evidenceExcerpt: text("evidence_excerpt").notNull(),
    action: workloadAbuseActionEnum("action").notNull().default("detected"),
    enforcementError: text("enforcement_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    userIdIdx: index("workload_abuse_detections_user_id_idx").on(table.userId),
    dseqIdx: index("workload_abuse_detections_dseq_idx").on(table.dseq)
  })
);
