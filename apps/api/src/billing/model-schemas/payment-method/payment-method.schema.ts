import { relations, sql } from "drizzle-orm";
import { pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { Users } from "@src/user/model-schemas";

export const PaymentMethods = pgTable("payment_methods", {
  id: uuid("id")
    .primaryKey()
    .notNull()
    .default(sql`uuid_generate_v4()`),
  userId: uuid("user_id")
    .references(() => Users.id, { onDelete: "cascade" })
    .notNull(),
  fingerprint: varchar("fingerprint", { length: 255 }).notNull(),
  paymentMethodId: varchar("payment_method_id", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const PaymentMethodsRelations = relations(PaymentMethods, ({ one }) => ({
  user: one(Users, {
    fields: [PaymentMethods.userId],
    references: [Users.id]
  })
}));
