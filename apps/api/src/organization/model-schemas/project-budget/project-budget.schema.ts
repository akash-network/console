import { sql } from "drizzle-orm";
import { boolean, date, foreignKey, integer, pgTable, smallint, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { Organizations } from "@src/organization/model-schemas/organization/organization.schema";
import { Projects } from "@src/organization/model-schemas/project/project.schema";
import { Users } from "@src/user/model-schemas/user/user.schema";

export const DEFAULT_ALERT_THRESHOLD_PERCENT = 80;

export const ProjectBudgets = pgTable(
  "project_budgets",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    organizationId: uuid("organization_id")
      .references(() => Organizations.id, { onDelete: "cascade" })
      .notNull(),
    projectId: uuid("project_id").notNull(),
    monthlyAmountCents: integer("monthly_amount_cents").notNull(),
    alertThresholdPercent: smallint("alert_threshold_percent").notNull().default(DEFAULT_ALERT_THRESHOLD_PERCENT),
    /** Off by default: a budget limits new deployments and leaves the funding of running ones alone unless this is set. */
    stopTopUps: boolean("stop_top_ups").notNull().default(false),
    /** First day of the UTC month the alert was last sent for, so it goes out once per project per month. */
    alertedForPeriod: date("alerted_for_period"),
    createdByUserId: uuid("created_by_user_id").references(() => Users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    organizationIdProjectIdUnique: unique("project_budgets_organization_id_project_id_unique").on(table.organizationId, table.projectId),
    projectFk: foreignKey({
      name: "project_budgets_organization_id_project_id_fk",
      columns: [table.organizationId, table.projectId],
      foreignColumns: [Projects.organizationId, Projects.id]
    }).onDelete("cascade")
  })
);
