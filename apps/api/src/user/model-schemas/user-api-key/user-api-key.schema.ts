import { sql } from "drizzle-orm";
import { boolean, index, pgTable, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";

import { Users } from "@src/user/model-schemas";

export const UserApiKeys = pgTable(
  "user_api_keys",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    userId: uuid("user_id")
      .references(() => Users.id, { onDelete: "cascade" })
      .notNull(),
    apiKey: varchar("api_key").notNull(),
    description: varchar("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at"),
    isActive: boolean("is_active").default(true).notNull()
  },
  table => ({
    apiKeyIdx: unique("api_key_idx").on(table.apiKey),
    userIdIdx: index("user_id_idx").on(table.userId),
    isActiveIdx: index("is_active_idx").on(table.isActive)
  })
);
