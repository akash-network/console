import { sql } from "drizzle-orm";
import { boolean, index, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { Users } from "@src/user/model-schemas";

export const MAX_CONSENT_COPY_VERSION_LENGTH = 64;

/** Append-only: every acceptance or opt-in change adds a row, so the consent a user gave under each copy version stays on record. */
export const AssistantConsents = pgTable(
  "assistant_consents",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    userId: uuid("user_id")
      .references(() => Users.id, { onDelete: "cascade" })
      .notNull(),
    copyVersion: varchar("copy_version", { length: MAX_CONSENT_COPY_VERSION_LENGTH }).notNull(),
    processingAcceptedAt: timestamp("processing_accepted_at", { withTimezone: true }).notNull(),
    reviewOptIn: boolean("review_opt_in").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    userIdCreatedAtIdx: index("assistant_consents_user_id_created_at_idx").on(table.userId, table.createdAt)
  })
);
