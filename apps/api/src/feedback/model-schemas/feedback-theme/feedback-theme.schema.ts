import { sql } from "drizzle-orm";
import { type AnyPgColumn, doublePrecision, index, integer, pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { feedbackClassificationTypeEnum } from "../feedback-classification/feedback-classification.schema";

export const MAX_THEME_TITLE_LENGTH = 200;
const MAX_LINEAR_ISSUE_ID_LENGTH = 64;

export const feedbackThemeStatusEnum = pgEnum("feedback_theme_status", ["open", "merged", "wont_do", "linked"]);

export type FeedbackThemeStatus = (typeof feedbackThemeStatusEnum.enumValues)[number];

export const FeedbackThemes = pgTable(
  "feedback_themes",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    title: varchar("title", { length: MAX_THEME_TITLE_LENGTH }).notNull(),
    summary: text("summary"),
    type: feedbackClassificationTypeEnum("type"),
    status: feedbackThemeStatusEnum("status").notNull().default("open"),
    mergedIntoId: uuid("merged_into_id").references((): AnyPgColumn => FeedbackThemes.id, { onDelete: "set null" }),
    linearIssueId: varchar("linear_issue_id", { length: MAX_LINEAR_ISSUE_ID_LENGTH }),
    linearIssueUrl: text("linear_issue_url"),
    score: doublePrecision("score").notNull().default(0),
    itemCount: integer("item_count").notNull().default(0),
    distinctUserCount: integer("distinct_user_count").notNull().default(0),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    statusScoreIdx: index("feedback_themes_status_score_idx").on(table.status, table.score)
  })
);
