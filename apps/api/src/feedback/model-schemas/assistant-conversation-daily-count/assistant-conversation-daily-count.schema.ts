import { date, integer, pgTable, timestamp } from "drizzle-orm/pg-core";

/** Counts every conversation by how it ended, stored or not, and carries nothing that identifies a user. */
export const AssistantConversationDailyCounts = pgTable("assistant_conversation_daily_counts", {
  day: date("day").primaryKey(),
  resolvedCount: integer("resolved_count").notNull().default(0),
  unresolvedCount: integer("unresolved_count").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
