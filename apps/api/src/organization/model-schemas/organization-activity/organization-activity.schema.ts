import { sql } from "drizzle-orm";
import { foreignKey, index, jsonb, pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { Organizations } from "@src/organization/model-schemas/organization/organization.schema";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { Projects } from "@src/organization/model-schemas/project/project.schema";
import { Users } from "@src/user/model-schemas/user/user.schema";

export const organizationActivityTypeEnum = pgEnum("organization_activity_type", [
  "organization_created",
  "project_created",
  "member_invited",
  "member_joined",
  "deployment_created",
  "deployment_closed",
  "deployment_moved"
]);

export type OrganizationActivityType = (typeof organizationActivityTypeEnum.enumValues)[number];

/** The fields the activity feed renders for each type, so every recorder writes what the client reads. */
export type OrganizationActivityPayloads = {
  organization_created: { organizationName: string };
  project_created: { projectName: string };
  member_invited: { email: string; role: OrganizationRole };
  member_joined: { role: OrganizationRole };
  deployment_created: { dseq: string; name: string | null };
  deployment_closed: { dseq: string; name: string | null; reason: string | null };
  deployment_moved: { dseq: string; name: string | null; toProjectName: string };
};

export const OrganizationActivities = pgTable(
  "organization_activities",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    organizationId: uuid("organization_id")
      .references(() => Organizations.id, { onDelete: "cascade" })
      .notNull(),
    projectId: uuid("project_id"),
    actorUserId: uuid("actor_user_id").references(() => Users.id, { onDelete: "set null" }),
    type: organizationActivityTypeEnum("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    /** Millisecond precision, so the position a page cursor carries matches the stored value exactly. */
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow().notNull()
  },
  table => ({
    organizationIdCreatedAtIdIdx: index("organization_activities_organization_id_created_at_id_idx").on(
      table.organizationId,
      table.createdAt.desc(),
      table.id.desc()
    ),
    organizationIdProjectIdCreatedAtIdIdx: index("organization_activities_organization_id_project_id_created_at_id_idx").on(
      table.organizationId,
      table.projectId,
      table.createdAt.desc(),
      table.id.desc()
    ),
    projectFk: foreignKey({
      name: "organization_activities_organization_id_project_id_fk",
      columns: [table.organizationId, table.projectId],
      foreignColumns: [Projects.organizationId, Projects.id]
    }).onDelete("cascade")
  })
);
