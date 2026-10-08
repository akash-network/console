import { sql } from "drizzle-orm";
import { pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { Users } from "@src/user/model-schemas";

export const Affiliates = pgTable("affiliates", {
  id: uuid("id")
    .primaryKey()
    .notNull()
    .default(sql`uuid_generate_v4()`),
  userId: uuid("user_id")
    .references(() => Users.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  approvedAt: timestamp("approved_at", { withTimezone: true }).notNull(),
  approvedBy: varchar("approved_by", { length: 255 }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revokedBy: varchar("revoked_by", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
