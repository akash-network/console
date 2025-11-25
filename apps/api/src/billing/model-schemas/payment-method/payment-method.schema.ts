import { relations, sql } from "drizzle-orm";
import { boolean, index, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { Users } from "@src/user/model-schemas";

export const PaymentMethods = pgTable(
  "payment_methods",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    userId: uuid("user_id")
      .references(() => Users.id, { onDelete: "cascade" })
      .notNull(),
    fingerprint: varchar("fingerprint", { length: 255 }).notNull(),
    paymentMethodId: varchar("payment_method_id", { length: 255 }).notNull(),
    isValidated: boolean("is_validated").default(false).notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull()
  },
  table => ({
    fingerprintPaymentMethodIdUnique: uniqueIndex("payment_methods_fingerprint_payment_method_id_unique").on(table.fingerprint, table.paymentMethodId),
    fingerprintIdx: index("payment_methods_fingerprint_idx").on(table.fingerprint),
    userIdIdx: index("payment_methods_user_id_idx").on(table.userId),
    userIdIsValidatedIdx: index("payment_methods_user_id_is_validated_idx").on(table.userId, table.isValidated),
    userIdFingerprintPaymentMethodIdIdx: index("payment_methods_user_id_fingerprint_payment_method_id_idx").on(
      table.userId,
      table.fingerprint,
      table.paymentMethodId
    )
  })
);

export const PaymentMethodsRelations = relations(PaymentMethods, ({ one }) => ({
  user: one(Users, {
    fields: [PaymentMethods.userId],
    references: [Users.id]
  })
}));
