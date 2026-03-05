import { relations, sql } from "drizzle-orm";
import { bigint, boolean, index, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";

import { Users } from "@src/user/model-schemas/user/user.schema"; // eslint-disable-line import-x/no-cycle

export const Templates = pgTable(
  "template",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    userId: varchar("userId", { length: 255 }).notNull(),
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
    userIdIdx: index("template_userId_idx").on(table.userId)
  })
);

export const TemplatesRelations = relations(Templates, ({ one }) => ({
  user: one(Users, {
    fields: [Templates.userId],
    references: [Users.userId]
  })
}));
