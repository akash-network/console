import { date, integer, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { Users } from "@src/user/model-schemas";

/** One row per user holding only today's message and token counts and this minute's message count, which is all the rate limits need. */
export const AssistantUserUsage = pgTable("assistant_user_usage", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => Users.id, { onDelete: "cascade" }),
  day: date("day").notNull(),
  dayMessageCount: integer("day_message_count").notNull().default(0),
  minuteStartedAt: timestamp("minute_started_at", { withTimezone: true }).notNull(),
  minuteMessageCount: integer("minute_message_count").notNull().default(0),
  dayTokenCount: integer("day_token_count").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
