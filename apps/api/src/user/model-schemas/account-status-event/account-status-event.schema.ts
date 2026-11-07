import { sql } from "drizzle-orm";
import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { Users } from "@src/user/model-schemas/user/user.schema";

export const accountStatusActionEnum = pgEnum("account_status_action", ["suspend", "reinstate", "terminate"]);

export type AccountStatusEventOptions = { closeDeployments?: boolean; forfeitCredits?: boolean };

export const AccountStatusEvents = pgTable(
  "account_status_events",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    userId: uuid("user_id").references(() => Users.id, { onDelete: "set null" }),
    userEmail: varchar("user_email", { length: 255 }),
    action: accountStatusActionEnum("action").notNull(),
    actorStaffId: varchar("actor_staff_id", { length: 255 }),
    actorEmail: varchar("actor_email", { length: 255 }).notNull(),
    actorName: varchar("actor_name", { length: 255 }).notNull(),
    userReason: text("user_reason"),
    internalNote: text("internal_note"),
    options: jsonb("options").$type<AccountStatusEventOptions>().default({}).notNull(),
    notificationSentAt: timestamp("notification_sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    userIdCreatedAtIdx: index("account_status_events_user_id_created_at_idx").on(table.userId, table.createdAt.desc())
  })
);
