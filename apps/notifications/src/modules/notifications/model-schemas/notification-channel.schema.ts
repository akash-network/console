import { sql } from "drizzle-orm";
import { index, jsonb, pgEnum, pgTable, uuid, varchar } from "drizzle-orm/pg-core";

import { timestamps } from "@src/lib/db/timestamps";

export const NotificationChannelType = pgEnum("notification_channel_type", ["email"]);

export const NotificationChannel = pgTable(
  "notification_channels",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    name: varchar("name").notNull(),
    userId: uuid("user_id").notNull(),
    type: NotificationChannelType("type").notNull(),
    config: jsonb("config").notNull(),

    ...timestamps
  },
  table => [index("idx_notification_channels_user_id").on(table.userId), index("idx_notification_channels_created_at").on(table.createdAt)]
);
