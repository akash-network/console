import { sql } from "drizzle-orm";
import { index, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { TemplateVersions } from "@src/template-marketplace/model-schemas/template-version/template-version.schema";
import { Templates } from "@src/user/model-schemas/template/template.schema";

export const templateImageChangeStatusEnum = pgEnum("template_image_change_status", ["open", "accepted", "hidden"]);

export type TemplateImageChangeStatus = (typeof templateImageChangeStatusEnum.enumValues)[number];

export const MAX_TEMPLATE_IMAGE_LENGTH = 512;
export const MAX_IMAGE_DIGEST_LENGTH = 160;

/** An image whose digest moved under the tag a public template's current version names; staff resolve it from the admin app, which writes `status`, `resolved_by` and `resolved_at`. */
export const TemplateImageChanges = pgTable(
  "template_image_changes",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    templateId: uuid("template_id")
      .references(() => Templates.id, { onDelete: "cascade" })
      .notNull(),
    templateVersionId: uuid("template_version_id")
      .references(() => TemplateVersions.id, { onDelete: "cascade" })
      .notNull(),
    image: varchar("image", { length: MAX_TEMPLATE_IMAGE_LENGTH }).notNull(),
    oldDigest: varchar("old_digest", { length: MAX_IMAGE_DIGEST_LENGTH }).notNull(),
    newDigest: varchar("new_digest", { length: MAX_IMAGE_DIGEST_LENGTH }).notNull(),
    status: templateImageChangeStatusEnum("status").default("open").notNull(),
    detectedAt: timestamp("detected_at", { withTimezone: true }).defaultNow().notNull(),
    resolvedBy: varchar("resolved_by", { length: 255 }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true })
  },
  table => ({
    oneOpenChangePerTemplateImage: uniqueIndex("template_image_changes_open_template_image_unique")
      .on(table.templateId, table.image)
      .where(sql`${table.status} = 'open'`),
    statusDetectedAtIdx: index("template_image_changes_status_detected_at_idx").on(table.status, table.detectedAt)
  })
);
