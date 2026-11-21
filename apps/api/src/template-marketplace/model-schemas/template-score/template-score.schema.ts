import { boolean, doublePrecision, integer, jsonb, pgTable, primaryKey, timestamp, varchar } from "drizzle-orm/pg-core";

import type { TemplateScoreBreakdown } from "@src/template-marketplace/lib/template-scores/template-scores";
import { templateSourceEnum } from "@src/template-marketplace/model-schemas/template-usage-event/template-usage-event.schema";

/** Rewritten by the recompute job and read by the gallery and the admin app; the key names a template the way usage events do, so an awesome-akash id fits. */
export const TemplateScores = pgTable(
  "template_scores",
  {
    source: templateSourceEnum("source").notNull(),
    templateRef: varchar("template_ref", { length: 255 }).notNull(),
    popularScore: doublePrecision("popular_score").default(0).notNull(),
    trendingScore: doublePrecision("trending_score").default(0).notNull(),
    weeklyDeployers: integer("weekly_deployers").default(0).notNull(),
    isTrending: boolean("is_trending").default(false).notNull(),
    breakdown: jsonb("breakdown").$type<TemplateScoreBreakdown>().notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    pk: primaryKey({ columns: [table.source, table.templateRef] })
  })
);
