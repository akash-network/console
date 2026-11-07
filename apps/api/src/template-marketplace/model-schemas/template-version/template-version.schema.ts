import { sql } from "drizzle-orm";
import { integer, jsonb, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import type { TemplateHardware } from "@src/template/types/template";
import { Templates } from "@src/user/model-schemas/template/template.schema";
import { Users } from "@src/user/model-schemas/user/user.schema";

export const templateVersionStatusEnum = pgEnum("template_version_status", ["live", "held", "failed_checks"]);

export type TemplateVersionStatus = (typeof templateVersionStatusEnum.enumValues)[number];

export const TemplateVersions = pgTable(
  "template_versions",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    templateId: uuid("template_id")
      .references(() => Templates.id, { onDelete: "cascade" })
      .notNull(),
    version: integer("version").notNull(),
    sdl: text("sdl").notNull(),
    readme: text("readme"),
    askedValues: jsonb("asked_values")
      .$type<unknown[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    resources: jsonb("resources").$type<TemplateHardware>(),
    imageDigests: jsonb("image_digests")
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    checkResults: jsonb("check_results"),
    status: templateVersionStatusEnum("status").default("live").notNull(),
    createdById: uuid("created_by_id").references(() => Users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    templateIdVersionUnique: unique("template_versions_template_id_version_unique").on(table.templateId, table.version)
  })
);
