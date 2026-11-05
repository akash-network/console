import { bigint, date, pgTable, timestamp } from "drizzle-orm/pg-core";

export const AssistantDailyTokenUsage = pgTable("assistant_daily_token_usage", {
  day: date("day").primaryKey(),
  promptTokens: bigint("prompt_tokens", { mode: "number" }).notNull().default(0),
  completionTokens: bigint("completion_tokens", { mode: "number" }).notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
