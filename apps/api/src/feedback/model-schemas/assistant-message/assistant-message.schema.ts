import { sql } from "drizzle-orm";
import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { AssistantConversations } from "../assistant-conversation/assistant-conversation.schema";

const MAX_TOOL_NAME_LENGTH = 100;

export const assistantMessageRoleEnum = pgEnum("assistant_message_role", ["user", "assistant", "tool"]);

export type AssistantMessageRole = (typeof assistantMessageRoleEnum.enumValues)[number];

export const AssistantMessages = pgTable(
  "assistant_messages",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    conversationId: uuid("conversation_id")
      .references(() => AssistantConversations.id, { onDelete: "cascade" })
      .notNull(),
    role: assistantMessageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    toolName: varchar("tool_name", { length: MAX_TOOL_NAME_LENGTH }),
    toolPayload: jsonb("tool_payload").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    conversationIdCreatedAtIdx: index("assistant_messages_conversation_id_created_at_idx").on(table.conversationId, table.createdAt)
  })
);
