import { sql } from "drizzle-orm";
import { pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { Users } from "@src/user/model-schemas";

export const CheckoutSessions = pgTable("checkout_sessions", {
  id: uuid("id")
    .primaryKey()
    .notNull()
    .default(sql`uuid_generate_v4()`),
  userId: uuid("user_id")
    .references(() => Users.id)
    .notNull(),
  sessionId: varchar("session_id").unique().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
