import { sql } from "drizzle-orm";
import { boolean, index, jsonb, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

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
    deletedAt: timestamp("deleted_at"),
    isDefault: boolean("is_default").notNull().default(false),

    ...timestamps
  },
  table => [
    index("idx_notification_channels_user_id").on(table.userId),
    uniqueIndex("idx_notification_channels_user_id_is_default")
      .on(table.userId, table.isDefault)
      .where(sql`is_default = true and deleted_at is null`)
  ]
);
