import { sql } from "drizzle-orm";
import { boolean, index, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { Organizations } from "@src/organization/model-schemas/organization/organization.schema";
import { Users } from "@src/user/model-schemas/user/user.schema";

export const templateSourceEnum = pgEnum("template_source", ["console", "awesome_akash"]);

export type TemplateSource = (typeof templateSourceEnum.enumValues)[number];

export const templateUsageActionEnum = pgEnum("template_usage_action", ["deploy", "lease_created", "still_running_24h", "fork", "favorite", "unfavorite"]);

export type TemplateUsageAction = (typeof templateUsageActionEnum.enumValues)[number];

export const TemplateUsageEvents = pgTable(
  "template_usage_events",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    source: templateSourceEnum("source").notNull(),
    /** Text rather than a foreign key, so an awesome-akash id fits and deleting a Console template keeps its history. */
    templateRef: varchar("template_ref", { length: 255 }).notNull(),
    templateVersionId: uuid("template_version_id"),
    action: templateUsageActionEnum("action").notNull(),
    userId: uuid("user_id").references(() => Users.id, { onDelete: "set null" }),
    organizationId: uuid("organization_id").references(() => Organizations.id, { onDelete: "set null" }),
    /** No foreign key, so closing or deleting a deployment never touches or locks its events. */
    deploymentSettingId: uuid("deployment_setting_id"),
    dseq: varchar("dseq"),
    network: varchar("network", { length: 16 }).notNull(),
    isTrial: boolean("is_trial").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    refActionCreatedIdx: index("template_usage_events_ref_action_created_idx").on(table.source, table.templateRef, table.action, table.createdAt),
    deploymentActionUnique: uniqueIndex("template_usage_events_deployment_action_unique")
      .on(table.deploymentSettingId, table.action)
      .where(sql`${table.deploymentSettingId} IS NOT NULL`)
  })
);
