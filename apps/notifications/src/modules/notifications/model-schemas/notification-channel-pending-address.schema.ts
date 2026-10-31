import { sql } from "drizzle-orm";
import { index, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { timestamps } from "@src/lib/db/timestamps";
import { NotificationChannel } from "./notification-channel.schema";

export const NotificationChannelPendingAddress = pgTable(
  "notification_channel_pending_addresses",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    notificationChannelId: uuid("notification_channel_id")
      .notNull()
      .references(() => NotificationChannel.id, { onDelete: "cascade" }),
    address: varchar("address").notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),

    ...timestamps
  },
  table => [
    uniqueIndex("idx_notification_channel_pending_addresses_channel_address").on(table.notificationChannelId, table.address),
    uniqueIndex("idx_notification_channel_pending_addresses_token_hash").on(table.tokenHash)
  ]
);

export const AddressConfirmationEmail = pgTable(
  "address_confirmation_emails",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    userId: uuid("user_id").notNull(),
    address: varchar("address").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => [
    index("idx_address_confirmation_emails_user_id_created_at").on(table.userId, table.createdAt),
    index("idx_address_confirmation_emails_address_created_at").on(table.address, table.createdAt)
  ]
);
