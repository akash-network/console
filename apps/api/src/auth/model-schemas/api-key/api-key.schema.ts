import { sql } from "drizzle-orm";
import { foreignKey, index, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { Organizations } from "@src/organization/model-schemas/organization/organization.schema";
import { Projects } from "@src/organization/model-schemas/project/project.schema";
import { Users } from "@src/user/model-schemas";

export const ApiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    userId: uuid("user_id")
      .references(() => Users.id, { onDelete: "cascade" })
      .notNull(),
    organizationId: uuid("organization_id").references(() => Organizations.id),
    projectId: uuid("project_id"),
    hashedKey: varchar("hashed_key").notNull().unique(),
    keyFormat: varchar("key_format").notNull(),
    name: varchar("name").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at"),
    lastUsedAt: timestamp("last_used_at")
  },
  table => ({
    userIdIdx: index("api_keys_user_id_idx").on(table.userId),
    organizationIdProjectIdIdx: index("api_keys_organization_id_project_id_idx").on(table.organizationId, table.projectId),
    projectFk: foreignKey({
      name: "api_keys_organization_id_project_id_fk",
      columns: [table.organizationId, table.projectId],
      foreignColumns: [Projects.organizationId, Projects.id]
    })
  })
);
