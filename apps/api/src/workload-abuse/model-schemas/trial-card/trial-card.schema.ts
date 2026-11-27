import { sql } from "drizzle-orm";
import { pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

const HMAC_SHA256_HEX_LENGTH = 64;

export const TrialCards = pgTable(
  "trial_cards",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    cardHash: varchar("card_hash", { length: HMAC_SHA256_HEX_LENGTH }).notNull(),
    /** No foreign key, so a card stays spent after the account that used it is deleted. */
    userId: uuid("user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    cardHashUnique: uniqueIndex("trial_cards_card_hash_unique").on(table.cardHash),
    userIdUnique: uniqueIndex("trial_cards_user_id_unique").on(table.userId)
  })
);
