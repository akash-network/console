import { sql } from "drizzle-orm";
import { boolean, index, jsonb, pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { Organizations } from "@src/organization/model-schemas/organization/organization.schema";
import { Users } from "@src/user/model-schemas";
import { classificationColumns } from "../feedback-classification/feedback-classification.schema";
import { FeedbackThemes } from "../feedback-theme/feedback-theme.schema";

export const assistantConversationStatusEnum = pgEnum("assistant_conversation_status", ["open", "resolved", "unresolved"]);

export type AssistantConversationStatus = (typeof assistantConversationStatusEnum.enumValues)[number];

export type AssistantConversationContext = {
  page?: string;
  dseq?: string;
  isTrialing: boolean | null;
};

/** Holds only conversations the user allowed the team to review; the others are counted in assistant_conversation_daily_counts and never stored. */
export const AssistantConversations = pgTable(
  "assistant_conversations",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    userId: uuid("user_id")
      .references(() => Users.id, { onDelete: "cascade" })
      .notNull(),
    organizationId: uuid("organization_id").references(() => Organizations.id, { onDelete: "set null" }),
    status: assistantConversationStatusEnum("status").notNull().default("open"),
    resolvedByUser: boolean("resolved_by_user"),
    context: jsonb("context").$type<AssistantConversationContext>().notNull(),
    ...classificationColumns(),
    themeId: uuid("theme_id").references(() => FeedbackThemes.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).defaultNow().notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true })
  },
  table => ({
    userIdStartedAtIdx: index("assistant_conversations_user_id_started_at_idx").on(table.userId, table.startedAt),
    themeIdIdx: index("assistant_conversations_theme_id_idx").on(table.themeId)
  })
);
