import { relations, sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";

import { Users } from "@src/user/model-schemas";

/**
 * One data encryption key per user, held only in the form Cloud KMS wrapped it in. Rotation re-wraps
 * this one small row instead of rewriting every value the key protects, and deleting the user
 * crypto-shreds their secrets because no backup of a value is readable without this row.
 */
export const DataKeys = pgTable(
  "data_keys",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    userId: uuid("user_id")
      .references(() => Users.id, { onDelete: "cascade" })
      .notNull(),
    wrappedKey: text("wrapped_key").notNull(),
    /**
     * Alias of the KMS key version that wrapped this key. The same alias is inside the wrapped blob,
     * which stays authoritative; this column exists so "is anything still wrapped under version N" —
     * the question gating an irreversible key-version destroy — is an indexed count rather than a
     * parse of every row.
     */
    wrappedByKid: varchar("wrapped_by_kid", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull()
  },
  table => ({
    userIdUnique: unique("data_keys_user_id_unique").on(table.userId),
    wrappedByKidIdx: index("data_keys_wrapped_by_kid_idx").on(table.wrappedByKid)
  })
);

export const DataKeysRelations = relations(DataKeys, ({ one }) => ({
  user: one(Users, {
    fields: [DataKeys.userId],
    references: [Users.id]
  })
}));
