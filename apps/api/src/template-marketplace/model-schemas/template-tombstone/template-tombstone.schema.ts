import { pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/** Holds the removed page of a once-public template whose row went with its owner's account, since a personal organization is deleted outright and a template row cannot outlive it. */
export const TemplateTombstones = pgTable("template_tombstones", {
  templateId: uuid("template_id").primaryKey().notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  removedAt: timestamp("removed_at", { withTimezone: true }).defaultNow().notNull()
});
