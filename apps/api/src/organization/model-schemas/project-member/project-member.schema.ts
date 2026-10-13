import { sql } from "drizzle-orm";
import { foreignKey, index, pgEnum, pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { OrganizationMembers, type OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { Projects } from "@src/organization/model-schemas/project/project.schema";

export const projectRoleEnum = pgEnum("project_role", ["admin", "member", "viewer"]);

export type ProjectRole = (typeof projectRoleEnum.enumValues)[number];

/** Owners and admins reach every project and billing reaches none, so a grant they still hold has no effect. */
export const GRANT_HOLDING_ORGANIZATION_ROLES: readonly OrganizationRole[] = ["member", "viewer"];

export const ProjectMembers = pgTable(
  "project_members",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    organizationId: uuid("organization_id").notNull(),
    projectId: uuid("project_id").notNull(),
    userId: uuid("user_id").notNull(),
    role: projectRoleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    projectIdUserIdUnique: unique("project_members_project_id_user_id_unique").on(table.projectId, table.userId),
    userIdIdx: index("project_members_user_id_idx").on(table.userId),
    projectFk: foreignKey({
      name: "project_members_organization_id_project_id_fk",
      columns: [table.organizationId, table.projectId],
      foreignColumns: [Projects.organizationId, Projects.id]
    }).onDelete("cascade"),
    /** Removing someone from the organization drops every project grant they held in it. */
    organizationMemberFk: foreignKey({
      name: "project_members_organization_id_user_id_fk",
      columns: [table.organizationId, table.userId],
      foreignColumns: [OrganizationMembers.organizationId, OrganizationMembers.userId]
    }).onDelete("cascade")
  })
);
