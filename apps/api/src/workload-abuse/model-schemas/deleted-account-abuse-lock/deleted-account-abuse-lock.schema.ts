import { sql } from "drizzle-orm";
import { index, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

const HMAC_SHA256_HEX_LENGTH = 64;

export const DeletedAccountAbuseLocks = pgTable(
  "deleted_account_abuse_locks",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    identityHash: varchar("identity_hash", { length: HMAC_SHA256_HEX_LENGTH }),
    emailHash: varchar("email_hash", { length: HMAC_SHA256_HEX_LENGTH }),
    reason: varchar("reason", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    identityHashIdx: index("deleted_account_abuse_locks_identity_hash_idx").on(table.identityHash),
    emailHashIdx: index("deleted_account_abuse_locks_email_hash_idx").on(table.emailHash)
  })
);
