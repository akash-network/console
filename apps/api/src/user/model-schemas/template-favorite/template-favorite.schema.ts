import { relations, sql } from "drizzle-orm";
import { index, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { Templates } from "@src/user/model-schemas/template/template.schema";

export const TemplateFavorites = pgTable(
  "templateFavorite",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    userId: varchar("userId", { length: 255 }).notNull(),
    templateId: uuid("templateId")
      .notNull()
      .references(() => Templates.id, { onDelete: "cascade" }),
    addedDate: timestamp("addedDate").notNull()
  },
  table => ({
    userIdTemplateIdUnique: uniqueIndex("templateFavorite_userId_templateId_unique").on(table.userId, table.templateId),
    /** Leads with the template, so counting a template's favorites seeks instead of reading every favorite. */
    templateIdUserIdIdx: index("templateFavorite_templateId_userId_idx").on(table.templateId, table.userId)
  })
);

export const TemplateFavoritesRelations = relations(TemplateFavorites, ({ one }) => ({
  template: one(Templates, {
    fields: [TemplateFavorites.templateId],
    references: [Templates.id]
  })
}));
