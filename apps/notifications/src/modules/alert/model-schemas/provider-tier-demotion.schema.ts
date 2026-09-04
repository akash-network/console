import { sql } from "drizzle-orm";
import { bigint, index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { timestamps } from "@src/lib/db/timestamps";
import { Alert } from "./alert.schema";

export const ProviderTierDemotionNotificationStatus = pgEnum("provider_tier_demotion_notification_status", ["PENDING", "SENT"]);

export const ProviderTierDemotionState = pgTable("provider_tier_demotion_state", {
  id: integer("id").primaryKey().notNull().default(1),
  streamId: uuid("stream_id"),
  cursor: bigint("cursor", { mode: "bigint" })
    .notNull()
    .default(sql`0`),
  claimId: uuid("claim_id"),
  claimExpiresAt: timestamp("claim_expires_at", { withTimezone: true }),
  ...timestamps
});

export const ProviderTierDemotionNotification = pgTable(
  "provider_tier_demotion_notifications",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    streamId: uuid("stream_id").notNull(),
    cursor: bigint("cursor", { mode: "bigint" }).notNull(),
    alertId: uuid("alert_id")
      .notNull()
      .references(() => Alert.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    owner: text("owner").notNull(),
    dseq: text("dseq").notNull(),
    gseq: integer("gseq").notNull(),
    oseq: integer("oseq").notNull(),
    bseq: integer("bseq").notNull(),
    status: ProviderTierDemotionNotificationStatus("status").notNull().default("PENDING"),
    claimId: uuid("claim_id").notNull(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    ...timestamps
  },
  table => [
    uniqueIndex("provider_tier_demotion_notifications_delivery_uidx").on(
      table.streamId,
      table.cursor,
      table.alertId,
      table.owner,
      table.dseq,
      table.gseq,
      table.oseq,
      table.bseq,
      table.provider
    ),
    index("provider_tier_demotion_notifications_status_idx").on(table.status, table.claimedAt)
  ]
);
