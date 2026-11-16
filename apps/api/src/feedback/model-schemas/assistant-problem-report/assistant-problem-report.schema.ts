import { sql } from "drizzle-orm";
import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { Organizations } from "@src/organization/model-schemas/organization/organization.schema";
import { Users } from "@src/user/model-schemas";
import { MAX_CONSENT_COPY_VERSION_LENGTH } from "../assistant-consent/assistant-consent.schema";
import { AssistantTurnTraces } from "../assistant-turn-trace/assistant-turn-trace.schema";
import { classificationColumns } from "../feedback-classification/feedback-classification.schema";
import { FeedbackThemes } from "../feedback-theme/feedback-theme.schema";

export const assistantProblemReportStatusEnum = pgEnum("assistant_problem_report_status", ["new", "triaged", "fixed"]);

export type AssistantProblemReportStatus = (typeof assistantProblemReportStatusEnum.enumValues)[number];

export type ReportedTranscriptMessage = { role: "user" | "assistant"; content: string };

/** The transcript is null when the conversation is stored, since the report then points at the stored messages instead of copying them. */
export const AssistantProblemReports = pgTable(
  "assistant_problem_reports",
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
    turnTraceId: uuid("turn_trace_id").references(() => AssistantTurnTraces.id, { onDelete: "set null" }),
    note: text("note"),
    transcript: jsonb("transcript").$type<ReportedTranscriptMessage[]>(),
    consentCopyVersion: varchar("consent_copy_version", { length: MAX_CONSENT_COPY_VERSION_LENGTH }).notNull(),
    status: assistantProblemReportStatusEnum("status").notNull().default("new"),
    ...classificationColumns(),
    themeId: uuid("theme_id").references(() => FeedbackThemes.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    userIdCreatedAtIdx: index("assistant_problem_reports_user_id_created_at_idx").on(table.userId, table.createdAt),
    conversationIdIdx: index("assistant_problem_reports_conversation_id_idx").on(table.conversationId),
    statusCreatedAtIdx: index("assistant_problem_reports_status_created_at_idx").on(table.status, table.createdAt),
    themeIdIdx: index("assistant_problem_reports_theme_id_idx").on(table.themeId)
  })
);
