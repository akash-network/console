import { sql } from "drizzle-orm";
import { index, integer, pgTable, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";

import { Users } from "@src/user/model-schemas";

export const EmailVerificationCodes = pgTable(
  "email_verification_codes",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    userId: uuid("user_id")
      .references(() => Users.id, { onDelete: "cascade" })
      .notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    code: varchar("code", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  table => ({
    userIdIdx: index("email_verification_codes_user_id_idx").on(table.userId),
    expiresAtIdx: index("email_verification_codes_expires_at_idx").on(table.expiresAt),
    userIdUnique: unique("email_verification_codes_user_id_unique").on(table.userId)
  })
);
