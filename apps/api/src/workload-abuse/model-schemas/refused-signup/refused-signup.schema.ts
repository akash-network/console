import { sql } from "drizzle-orm";
import { index, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

const HMAC_SHA256_HEX_LENGTH = 64;

export const RefusedSignups = pgTable(
  "refused_signups",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    browserHash: varchar("browser_hash", { length: HMAC_SHA256_HEX_LENGTH }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    browserHashCreatedAtIdx: index("refused_signups_browser_hash_created_at_idx").on(table.browserHash, table.createdAt)
  })
);
