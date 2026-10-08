import { relations, sql } from "drizzle-orm";
import { bigint, boolean, foreignKey, index, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";

// eslint-disable-next-line import-x/no-cycle
import { Organizations } from "@src/organization/model-schemas/organization/organization.schema";
import { Projects } from "@src/organization/model-schemas/project/project.schema";
import { Users } from "@src/user/model-schemas/user/user.schema";

export const Templates = pgTable(
  "template",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    userId: varchar("userId", { length: 255 }).notNull(),
    organizationId: uuid("organization_id").references(() => Organizations.id),
    projectId: uuid("project_id"),
    copiedFromId: uuid("copiedFromId"),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    isPublic: boolean("isPublic").default(false).notNull(),
    cpu: bigint("cpu", { mode: "number" }).notNull(),
    ram: bigint("ram", { mode: "number" }).notNull(),
    storage: bigint("storage", { mode: "number" }).notNull(),
    sdl: text("sdl").notNull()
  },
  table => ({
    userIdIdx: index("template_userId_idx").on(table.userId),
    organizationIdProjectIdIdx: index("template_organization_id_project_id_idx").on(table.organizationId, table.projectId),
    projectFk: foreignKey({
      name: "template_organization_id_project_id_fk",
      columns: [table.organizationId, table.projectId],
      foreignColumns: [Projects.organizationId, Projects.id]
    })
  })
);

export const TemplatesRelations = relations(Templates, ({ one }) => ({
  user: one(Users, {
    fields: [Templates.userId],
    references: [Users.userId]
  })
}));
