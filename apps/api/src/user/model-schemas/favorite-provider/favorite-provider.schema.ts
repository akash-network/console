import { sql } from "drizzle-orm";
import { pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { Users } from "@src/user/model-schemas/user/user.schema";

export const FavoriteProviders = pgTable(
  "favorite_providers",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    userId: uuid("user_id")
      .references(() => Users.id, { onDelete: "cascade" })
      .notNull(),
    providerAddress: varchar("provider_address", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    userIdProviderAddressIdx: uniqueIndex("favorite_providers_user_id_provider_address_idx").on(table.userId, table.providerAddress)
  })
);
