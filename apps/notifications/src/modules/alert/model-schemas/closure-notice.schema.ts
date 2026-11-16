import { sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { NotificationChannel } from "@src/modules/notifications/model-schemas";
import { Alert } from "./alert.schema";

export const ClosureNotice = pgTable(
  "closure_notices",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    alertId: uuid("alert_id")
      .notNull()
      .references(() => Alert.id, { onDelete: "cascade" }),
    notificationChannelId: uuid("notification_channel_id")
      .notNull()
      .references(() => NotificationChannel.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    organizationId: uuid("organization_id"),
    projectId: uuid("project_id"),
    owner: text("owner").notNull(),
    dseq: text("dseq").notNull(),
    deploymentLabel: text("deployment_label").notNull(),
    deploymentLink: text("deployment_link").notNull(),
    deploymentClosed: boolean("deployment_closed").notNull(),
    providerLabel: text("provider_label"),
    leaseClosedReason: integer("lease_closed_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true })
  },
  table => [
    uniqueIndex("idx_closure_notices_pending_alert_id").on(table.alertId).where(sql`sent_at IS NULL`),
    index("idx_closure_notices_notification_channel_id_sent_at").on(table.notificationChannelId, table.sentAt),
    index("idx_closure_notices_sent_at").on(table.sentAt)
  ]
);
