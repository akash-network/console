import { pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { Users } from "@src/user/model-schemas/user/user.schema";

/** One row per person ever keeps the win-back a one-time offer; a null `closes_at` means the person never paid and keeps the bonus with no deadline. */
export const FirstPurchaseBonusWinBacks = pgTable("first_purchase_bonus_win_backs", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => Users.id, { onDelete: "cascade" }),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull(),
  closesAt: timestamp("closes_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
