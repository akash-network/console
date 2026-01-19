import { relations, sql } from "drizzle-orm";
import { boolean, numeric, pgTable, serial, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

// Users table - matches existing "userSetting" table in console API
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
  bio: varchar("bio", { length: 1000 }),
  subscribedToNewsletter: boolean("subscribedToNewsletter").default(false).notNull(),
  youtubeUsername: varchar("youtubeUsername", { length: 255 }),
  twitterUsername: varchar("twitterUsername", { length: 255 }),
  githubUsername: varchar("githubUsername", { length: 255 }),
  lastActiveAt: timestamp("last_active_at").defaultNow(),
  lastIp: varchar("last_ip", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow()
});

// User wallets table - matches existing "user_wallets" table
export const UserWallets = pgTable("user_wallets", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id")
    .references(() => Users.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  address: varchar("address").unique(),
  deploymentAllowance: numeric("deployment_allowance", { precision: 20, scale: 2 }).notNull().default("0.00"),
  feeAllowance: numeric("fee_allowance", { precision: 20, scale: 2 }).notNull().default("0.00"),
  isTrialing: boolean("trial").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Stripe transactions table - for tracking credit purchases
export const StripeTransactions = pgTable("stripe_transactions", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").references(() => Users.id, { onDelete: "cascade" }),
  paymentIntentId: varchar("payment_intent_id", { length: 255 }),
  amount: numeric("amount", { precision: 20, scale: 2 }),
  currency: varchar("currency", { length: 10 }),
  status: varchar("status", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Relations
export const UsersRelations = relations(Users, ({ one }) => ({
  wallet: one(UserWallets, {
    fields: [Users.id],
    references: [UserWallets.userId]
  })
}));

export const UserWalletsRelations = relations(UserWallets, ({ one }) => ({
  user: one(Users, {
    fields: [UserWallets.userId],
    references: [Users.id]
  })
}));
