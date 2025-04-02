import { relations, sql } from "drizzle-orm";
import { boolean, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { UserWallets } from "@src/billing/model-schemas/user-wallet/user-wallet.schema"; // eslint-disable-line import-x/no-cycle

export const Users = pgTable("userSetting", {
  id: uuid("id")
    .primaryKey()
    .notNull()
    .default(sql`uuid_generate_v4()`),
  userId: varchar("userId", { length: 255 }).unique(),
  username: varchar("username", { length: 255 }).unique(),
  email: varchar("email", { length: 255 }),
  emailVerified: boolean("emailVerified").default(false).notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  bio: text("bio"),
  subscribedToNewsletter: boolean("subscribedToNewsletter").default(false).notNull(),
  youtubeUsername: varchar("youtubeUsername", { length: 255 }),
  twitterUsername: varchar("twitterUsername", { length: 255 }),
  githubUsername: varchar("githubUsername", { length: 255 }),
  lastActiveAt: timestamp("last_active_at").defaultNow(),
  lastIp: varchar("last_ip", { length: 255 }),
  lastUserAgent: varchar("last_user_agent", { length: 255 }),
  lastFingerprint: varchar("last_fingerprint", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow()
});

export const UsersRelations = relations(Users, ({ one }) => ({
  userWallets: one(UserWallets, {
    fields: [Users.id],
    references: [UserWallets.userId]
  })
}));
