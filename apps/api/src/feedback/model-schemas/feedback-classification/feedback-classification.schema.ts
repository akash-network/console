import { boolean, doublePrecision, integer, pgEnum, text, timestamp } from "drizzle-orm/pg-core";

export const feedbackClassificationTypeEnum = pgEnum("feedback_classification_type", ["support_question", "bug", "feature_request", "ux_friction"]);

export type FeedbackClassificationType = (typeof feedbackClassificationTypeEnum.enumValues)[number];

export interface FailedClassification {
  attempts: number;
  abandoned: boolean;
}

/** Every classified item carries the same fields, so each table gets its own column builders from here. */
export function classificationColumns() {
  return {
    classificationType: feedbackClassificationTypeEnum("classification_type"),
    classificationSummary: text("classification_summary"),
    sentimentScore: doublePrecision("sentiment_score"),
    endedStuck: boolean("ended_stuck"),
    classifiedAt: timestamp("classified_at", { withTimezone: true }),
    classificationAttempts: integer("classification_attempts").notNull().default(0),
    classificationFailedAt: timestamp("classification_failed_at", { withTimezone: true })
  };
}
