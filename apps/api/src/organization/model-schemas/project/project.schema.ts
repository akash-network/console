import { sql } from "drizzle-orm";
import { boolean, pgTable, timestamp, unique, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

// eslint-disable-next-line import-x/no-cycle
import { Organizations } from "@src/organization/model-schemas/organization/organization.schema";
import { Users } from "@src/user/model-schemas/user/user.schema";

export const MAX_PROJECT_NAME_LENGTH = 64;
export const MAX_PROJECT_SLUG_LENGTH = 40;
export const MAX_PROJECT_DESCRIPTION_LENGTH = 140;

export const DEFAULT_PROJECT_NAME = "default";
export const DEFAULT_PROJECT_SLUG = "default";

export const Projects = pgTable(
  "projects",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    organizationId: uuid("organization_id")
      .references(() => Organizations.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: MAX_PROJECT_NAME_LENGTH }).notNull(),
    slug: varchar("slug", { length: MAX_PROJECT_SLUG_LENGTH }).notNull(),
    description: varchar("description", { length: MAX_PROJECT_DESCRIPTION_LENGTH }),
    isDefault: boolean("is_default").notNull().default(false),
    createdByUserId: uuid("created_by_user_id").references(() => Users.id, { onDelete: "set null" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    /** Target of the composite foreign keys that keep a project-bearing row inside the project's own organization. */
    organizationIdIdUnique: unique("projects_organization_id_id_unique").on(table.organizationId, table.id),
    organizationIdSlugUnique: uniqueIndex("projects_organization_id_slug_unique")
      .on(table.organizationId, table.slug)
      .where(sql`${table.deletedAt} IS NULL`),
    organizationIdDefaultUnique: uniqueIndex("projects_organization_id_default_unique")
      .on(table.organizationId)
      .where(sql`${table.isDefault} = true`)
  })
);
