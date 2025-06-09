import { sql } from "drizzle-orm";
import { jsonb, pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const NotificationChannelType = pgEnum("notification_channel_type", ["email"]);

export const NotificationChannel = pgTable("notification_channels", {
  id: uuid("id")
    .primaryKey()
    .notNull()
    .default(sql`uuid_generate_v4()`),
  name: varchar("name").notNull(),
  userId: uuid("user_id").unique(),
  type: NotificationChannelType("type").notNull(),
  config: jsonb("config").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
