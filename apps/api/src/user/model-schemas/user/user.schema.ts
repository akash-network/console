import { sql } from "drizzle-orm";
import { boolean, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const userSchema = pgTable("userSetting", {
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
  createdAt: timestamp("created_at").defaultNow()
});
