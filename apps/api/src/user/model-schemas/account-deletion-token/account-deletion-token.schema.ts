import { sql } from "drizzle-orm";
import { doublePrecision, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { Users } from "@src/user/model-schemas/user/user.schema";

export const AccountDeletionTokens = pgTable(
  "account_deletion_tokens",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    userId: uuid("user_id")
      .references(() => Users.id, { onDelete: "cascade" })
      .notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    acknowledgedForfeitUsd: doublePrecision("acknowledged_forfeit_usd").default(0).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    userIdIdx: uniqueIndex("account_deletion_tokens_user_id_idx").on(table.userId),
    tokenHashIdx: uniqueIndex("account_deletion_tokens_token_hash_idx").on(table.tokenHash)
  })
);
