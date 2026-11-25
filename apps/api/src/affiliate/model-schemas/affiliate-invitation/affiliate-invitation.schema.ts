import { pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { Users } from "@src/user/model-schemas";

/** One row per person ever keeps the referral program invitation a one-time email. */
export const AffiliateInvitations = pgTable("affiliate_invitations", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => Users.id, { onDelete: "cascade" }),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
