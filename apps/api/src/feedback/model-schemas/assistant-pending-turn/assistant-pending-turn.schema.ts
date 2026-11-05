import { index, jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import type { ChatMessage, ChatToolCall } from "@src/feedback/services/akashml-client/akashml.client";
import { Users } from "@src/user/model-schemas";

export type AssistantPendingTurnState = {
  messages: ChatMessage[];
  clientToolCalls: ChatToolCall[];
  roundsUsed: number;
  stored: boolean;
  isTrialing: boolean | null;
};

/** A turn paused on a browser tool, held only until the browser answers or the row expires, whatever the user consented to. */
export const AssistantPendingTurns = pgTable(
  "assistant_pending_turns",
  {
    conversationId: uuid("conversation_id").primaryKey(),
    userId: uuid("user_id")
      .references(() => Users.id, { onDelete: "cascade" })
      .notNull(),
    state: jsonb("state").$type<AssistantPendingTurnState>().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    expiresAtIdx: index("assistant_pending_turns_expires_at_idx").on(table.expiresAt)
  })
);
