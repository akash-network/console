import { sql } from "drizzle-orm";
import { index, pgEnum, pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { Organizations } from "@src/organization/model-schemas/organization/organization.schema";
import { Users } from "@src/user/model-schemas/user/user.schema";

export const organizationRoleEnum = pgEnum("organization_role", ["owner", "admin", "member", "billing", "viewer"]);

export type OrganizationRole = (typeof organizationRoleEnum.enumValues)[number];

export const OrganizationMembers = pgTable(
  "organization_members",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    organizationId: uuid("organization_id")
      .references(() => Organizations.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => Users.id, { onDelete: "cascade" })
      .notNull(),
    role: organizationRoleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    organizationIdUserIdUnique: unique("organization_members_organization_id_user_id_unique").on(table.organizationId, table.userId),
    userIdIdx: index("organization_members_user_id_idx").on(table.userId)
  })
);
