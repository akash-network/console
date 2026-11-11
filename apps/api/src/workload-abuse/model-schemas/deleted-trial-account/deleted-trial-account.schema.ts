import { sql } from "drizzle-orm";
import { index, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

const HMAC_SHA256_HEX_LENGTH = 64;

export const DeletedTrialAccounts = pgTable(
  "deleted_trial_accounts",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    identityHash: varchar("identity_hash", { length: HMAC_SHA256_HEX_LENGTH }),
    emailHash: varchar("email_hash", { length: HMAC_SHA256_HEX_LENGTH }),
    walletAddress: varchar("wallet_address"),
    /** The account last refused a trial over this row, so its review is raised once however often its activation is retried. */
    refusedUserId: uuid("refused_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    identityHashIdx: index("deleted_trial_accounts_identity_hash_idx").on(table.identityHash),
    emailHashIdx: index("deleted_trial_accounts_email_hash_idx").on(table.emailHash)
  })
);
