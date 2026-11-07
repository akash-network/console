import { relations, sql } from "drizzle-orm";
import { bigint, boolean, foreignKey, index, pgEnum, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

// eslint-disable-next-line import-x/no-cycle
import { Organizations } from "@src/organization/model-schemas/organization/organization.schema";
import { Projects } from "@src/organization/model-schemas/project/project.schema";
import { Users } from "@src/user/model-schemas/user/user.schema";

export const templateVisibilityEnum = pgEnum("template_visibility", ["private", "organization", "public"]);
export const templateModerationStatusEnum = pgEnum("template_moderation_status", ["active", "hidden", "removed"]);

export type TemplateVisibility = (typeof templateVisibilityEnum.enumValues)[number];
export type TemplateModerationStatus = (typeof templateModerationStatusEnum.enumValues)[number];

export const Templates = pgTable(
  "template",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    userId: varchar("userId", { length: 255 }),
    organizationId: uuid("organization_id").references(() => Organizations.id),
    projectId: uuid("project_id"),
    copiedFromId: uuid("copiedFromId"),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    isPublic: boolean("isPublic").default(false).notNull(),
    cpu: bigint("cpu", { mode: "number" }).notNull(),
    ram: bigint("ram", { mode: "number" }).notNull(),
    storage: bigint("storage", { mode: "number" }).notNull(),
    sdl: text("sdl").notNull(),
    authorId: uuid("author_id").references(() => Users.id, { onDelete: "set null" }),
    summary: varchar("summary", { length: 300 }),
    icon: varchar("icon", { length: 32 }),
    categories: text("categories")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    visibility: templateVisibilityEnum("visibility").default("private").notNull(),
    isListed: boolean("listed").default(true).notNull(),
    isOfficial: boolean("official").default(false).notNull(),
    isFeatured: boolean("featured").default(false).notNull(),
    moderationStatus: templateModerationStatusEnum("moderation_status").default("active").notNull(),
    currentVersionId: uuid("current_version_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
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
