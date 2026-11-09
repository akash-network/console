import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { Organizations } from "@src/organization/model-schemas/organization/organization.schema";
import { Users } from "@src/user/model-schemas";

export const assistantTurnOutcomeEnum = pgEnum("assistant_turn_outcome", [
  "running",
  "answered",
  "recovered",
  "fallback",
  "timed_out",
  "awaiting_browser",
  "model_failed",
  "failed",
  "cancelled",
  "limited",
  "blocked"
]);

export type AssistantTurnOutcome = (typeof assistantTurnOutcomeEnum.enumValues)[number];

export type TracedToolCall = { name: string; ok: boolean; durationMs: number };

export type TracedCard = { proposalId: string; actionType: string; decision: string | null };

/** Kept for every turn whatever the user consented to, so it must never hold message text, tool arguments or tool results. */
export const AssistantTurnTraces = pgTable(
  "assistant_turn_traces",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    userId: uuid("user_id")
      .references(() => Users.id, { onDelete: "cascade" })
      .notNull(),
    organizationId: uuid("organization_id").references(() => Organizations.id, { onDelete: "set null" }),
    conversationId: uuid("conversation_id").notNull(),
    page: varchar("page", { length: 500 }),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    outcome: assistantTurnOutcomeEnum("outcome").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    firstTokenMs: integer("first_token_ms"),
    durationMs: integer("duration_ms").notNull(),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    toolCalls: jsonb("tool_calls").$type<TracedToolCall[]>().notNull().default([]),
    cards: jsonb("cards").$type<TracedCard[]>().notNull().default([])
  },
  table => ({
    userIdStartedAtIdx: index("assistant_turn_traces_user_id_started_at_idx").on(table.userId, table.startedAt),
    conversationIdIdx: index("assistant_turn_traces_conversation_id_idx").on(table.conversationId),
    startedAtIdx: index("assistant_turn_traces_started_at_idx").on(table.startedAt)
  })
);
