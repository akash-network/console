import { sql } from "drizzle-orm";
import { index, integer, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { Users } from "@src/user/model-schemas";
import { Affiliates } from "../affiliate/affiliate.schema";

export const Referrals = pgTable(
  "referrals",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    referredUserId: uuid("referred_user_id")
      .references(() => Users.id, { onDelete: "cascade" })
      .notNull()
      .unique(),
    affiliateId: uuid("affiliate_id")
      .references(() => Affiliates.id, { onDelete: "cascade" })
      .notNull(),
    trialCreditsCents: integer("trial_credits_cents"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    affiliateIdIdx: index("referrals_affiliate_id_idx").on(table.affiliateId)
  })
);
