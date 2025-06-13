import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { timestamps } from "@src/lib/db/timestamps";
import { NotificationChannel } from "@src/modules/notifications/model-schemas";

export const AlertStatus = pgEnum("alert_status", ["OK", "TRIGGERED"]);
export const AlertType = pgEnum("alert_type", ["CHAIN_MESSAGE", "DEPLOYMENT_BALANCE"]);

export const Alert = pgTable(
  "alerts",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    userId: uuid("user_id").notNull(),
    notificationChannelId: uuid("notification_channel_id")
      .notNull()
      .references(() => NotificationChannel.id),
    name: text("name").notNull(),
    summary: text("summary").notNull(),
    description: text("description").notNull(),
    conditions: jsonb("conditions").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    type: AlertType("type").notNull(),
    status: AlertStatus("status").notNull().default("OK"),
    params: jsonb("params"),
    minBlockHeight: integer("min_block_height").notNull().default(0),

    ...timestamps
  },
  table => [
    index("idx_alerts_user_id").on(table.userId),
    index("idx_alerts_notification_channel_id").on(table.notificationChannelId),
    index("idx_alerts_status").on(table.status),
    index("idx_alerts_min_block_height_id").on(table.minBlockHeight, table.id),
    index("idx_alerts_created_at_id").on(table.createdAt, table.id),
    index("idx_alerts_params").using("gin", sql`${table.params} jsonb_path_ops`),
    index("idx_alerts_enabled_type_status").on(table.enabled, table.type, table.status)
  ]
);
