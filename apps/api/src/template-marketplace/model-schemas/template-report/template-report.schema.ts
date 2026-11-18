import { sql } from "drizzle-orm";
import { index, pgEnum, pgTable, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";

import { Organizations } from "@src/organization/model-schemas/organization/organization.schema";
import { TemplateVersions } from "@src/template-marketplace/model-schemas/template-version/template-version.schema";
import { Templates } from "@src/user/model-schemas/template/template.schema";
import { Users } from "@src/user/model-schemas/user/user.schema";

export const templateReportReasonEnum = pgEnum("template_report_reason", ["malware_or_miner", "leaks_secrets", "impersonation", "spam", "broken", "other"]);
export const templateReportStatusEnum = pgEnum("template_report_status", ["open", "actioned", "dismissed"]);

export type TemplateReportReason = (typeof templateReportReasonEnum.enumValues)[number];
export type TemplateReportStatus = (typeof templateReportStatusEnum.enumValues)[number];

export const MAX_TEMPLATE_REPORT_DETAILS_LENGTH = 1000;

/** Staff resolve reports from the admin app, which writes `status`, `assignee`, `resolved_by` and `resolved_at`; the reporter columns never leave this table through a user-facing route. */
export const TemplateReports = pgTable(
  "template_reports",
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
    reporterUserId: uuid("reporter_user_id").references(() => Users.id, { onDelete: "set null" }),
    reporterOrganizationId: uuid("reporter_organization_id").references(() => Organizations.id, { onDelete: "set null" }),
    reason: templateReportReasonEnum("reason").notNull(),
    details: varchar("details", { length: MAX_TEMPLATE_REPORT_DETAILS_LENGTH }),
    status: templateReportStatusEnum("status").default("open").notNull(),
    assignee: varchar("assignee", { length: 255 }),
    resolvedBy: varchar("resolved_by", { length: 255 }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    oneReportPerVersionAndReporter: unique("template_reports_template_version_reporter_unique").on(
      table.templateId,
      table.templateVersionId,
      table.reporterUserId
    ),
    statusCreatedAtIdx: index("template_reports_status_created_at_idx").on(table.status, table.createdAt),
    reporterUserIdCreatedAtIdx: index("template_reports_reporter_user_id_created_at_idx").on(table.reporterUserId, table.createdAt),
    reporterOrganizationIdCreatedAtIdx: index("template_reports_reporter_organization_id_created_at_idx").on(table.reporterOrganizationId, table.createdAt)
  })
);
