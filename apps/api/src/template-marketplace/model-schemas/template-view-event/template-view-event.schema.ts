import { sql } from "drizzle-orm";
import { boolean, date, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { Templates } from "@src/user/model-schemas/template/template.schema";

export const templateViewKindEnum = pgEnum("template_view_kind", ["page_view", "configure_open"]);

export type TemplateViewKind = (typeof templateViewKindEnum.enumValues)[number];

/** One row per signed-in viewer, template, kind and day, so a viewer counts once a day however often they come back. */
export const TemplateViewEvents = pgTable(
  "template_view_events",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    templateId: uuid("template_id")
      .references(() => Templates.id, { onDelete: "cascade" })
      .notNull(),
    kind: templateViewKindEnum("kind").notNull(),
    /** A hash of the viewer's id with the template, kind and day, so the table holds no user id and a key never repeats across templates or days. */
    viewerKey: varchar("viewer_key", { length: 64 }).notNull(),
    fromPublisher: boolean("from_publisher").notNull(),
    network: varchar("network", { length: 16 }).notNull(),
    viewedOn: date("viewed_on", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    oncePerDayUnique: uniqueIndex("template_view_events_once_per_day_unique").on(table.templateId, table.network, table.viewedOn, table.kind, table.viewerKey)
  })
);
