import { sql } from "drizzle-orm";
import { check, index, jsonb, pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const templateModerationActionEnum = pgEnum("template_moderation_action", [
  "hide",
  "unhide",
  "remove",
  "approve_version",
  "reject_version",
  "rollback_version",
  "promote_official",
  "remove_official",
  "feature",
  "unfeature",
  "edit_categories",
  "accept_image_change",
  "suspend_publisher",
  "reinstate_publisher",
  "verify_publisher",
  "unverify_publisher"
]);

export type TemplateModerationAction = (typeof templateModerationActionEnum.enumValues)[number];

/** Written by the admin app in the transaction that applies the action; `template_id` and `organization_id` carry no foreign key, so the log outlives what it is about. */
export const TemplateModerationEvents = pgTable(
  "template_moderation_events",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    templateId: uuid("template_id"),
    templateVersionId: uuid("template_version_id"),
    organizationId: uuid("organization_id"),
    action: templateModerationActionEnum("action").notNull(),
    staffEmail: varchar("staff_email", { length: 255 }).notNull(),
    reason: text("reason").notNull(),
    details: jsonb("details")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    reasonNotBlank: check("template_moderation_events_reason_not_blank", sql`length(btrim(${table.reason})) > 0`),
    namesItsSubject: check("template_moderation_events_names_its_subject", sql`${table.templateId} IS NOT NULL OR ${table.organizationId} IS NOT NULL`),
    templateIdCreatedAtIdx: index("template_moderation_events_template_id_created_at_idx").on(table.templateId, table.createdAt),
    organizationIdCreatedAtIdx: index("template_moderation_events_organization_id_created_at_idx").on(table.organizationId, table.createdAt)
  })
);
