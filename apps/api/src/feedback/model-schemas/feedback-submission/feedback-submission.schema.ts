import { sql } from "drizzle-orm";
import { boolean, check, index, jsonb, pgEnum, pgTable, smallint, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { Organizations } from "@src/organization/model-schemas/organization/organization.schema";
import { Users } from "@src/user/model-schemas";
import { classificationColumns } from "../feedback-classification/feedback-classification.schema";
import { FeedbackThemes } from "../feedback-theme/feedback-theme.schema";

export const MAX_FEEDBACK_MESSAGE_LENGTH = 4000;
export const MAX_DSEQ_LENGTH = 20;

export const feedbackKindEnum = pgEnum("feedback_kind", ["deployment_outcome", "general"]);
export const feedbackDeploymentOutcomeEnum = pgEnum("feedback_deployment_outcome", ["live", "failed"]);
export const feedbackCategoryEnum = pgEnum("feedback_category", ["bug", "feature_request", "other"]);

export type FeedbackKind = (typeof feedbackKindEnum.enumValues)[number];
export type DeploymentOutcome = (typeof feedbackDeploymentOutcomeEnum.enumValues)[number];
export type FeedbackCategory = (typeof feedbackCategoryEnum.enumValues)[number];

export type FeedbackContext = {
  page?: string;
  failureReason?: string;
  isTrialing: boolean | null;
};

export const FeedbackSubmissions = pgTable(
  "feedback_submissions",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    userId: uuid("user_id")
      .references(() => Users.id, { onDelete: "cascade" })
      .notNull(),
    organizationId: uuid("organization_id").references(() => Organizations.id, { onDelete: "set null" }),
    kind: feedbackKindEnum("kind").notNull(),
    dseq: varchar("dseq", { length: MAX_DSEQ_LENGTH }),
    outcome: feedbackDeploymentOutcomeEnum("outcome"),
    dismissed: boolean("dismissed").notNull().default(false),
    rating: smallint("rating"),
    category: feedbackCategoryEnum("category"),
    message: text("message"),
    context: jsonb("context").$type<FeedbackContext>().notNull(),
    ...classificationColumns(),
    themeId: uuid("theme_id").references(() => FeedbackThemes.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    userIdCreatedAtIdx: index("feedback_submissions_user_id_created_at_idx").on(table.userId, table.createdAt),
    userIdDseqIdx: uniqueIndex("feedback_submissions_user_id_dseq_idx")
      .on(table.userId, table.dseq)
      .where(sql`${table.kind} = 'deployment_outcome'`),
    themeIdIdx: index("feedback_submissions_theme_id_idx").on(table.themeId),
    ratingRange: check("feedback_submissions_rating_range", sql`${table.rating} BETWEEN 1 AND 5`),
    unclassifiedIdx: index("feedback_submissions_unclassified_idx")
      .on(table.createdAt)
      .where(sql`${table.classifiedAt} IS NULL AND ${table.dismissed} = false`)
  })
);
