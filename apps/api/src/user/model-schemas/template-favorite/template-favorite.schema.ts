import { relations, sql } from "drizzle-orm";
import { pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { Templates } from "@src/user/model-schemas/template/template.schema"; // eslint-disable-line import-x/no-cycle

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
    userIdTemplateIdUnique: uniqueIndex("templateFavorite_userId_templateId_unique").on(table.userId, table.templateId)
  })
);

export const TemplateFavoritesRelations = relations(TemplateFavorites, ({ one }) => ({
  template: one(Templates, {
    fields: [TemplateFavorites.templateId],
    references: [Templates.id]
  })
}));
