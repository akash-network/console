import { sql } from "drizzle-orm";
import { jsonb, pgEnum, pgTable, uuid, varchar } from "drizzle-orm/pg-core";

import { timestamps } from "@src/lib/db/timestamps";

export const NotificationChannelType = pgEnum("notification_channel_type", ["email"]);

export const NotificationChannel = pgTable("notification_channels", {
  id: uuid("id")
    .primaryKey()
    .notNull()
    .default(sql`uuid_generate_v4()`),
  userId: uuid("user_id").notNull(),
  name: varchar("name").notNull(),
  type: NotificationChannelType("type").notNull(),
  config: jsonb("config").notNull(),

  ...timestamps
});
