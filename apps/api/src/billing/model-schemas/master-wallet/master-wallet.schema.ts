import { pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";

export const MasterWallets = pgTable("master_wallets", {
  id: serial("id").primaryKey(),
  address: varchar("address").unique().notNull(),
  category: varchar("category").notNull(), // 'company' or 'community'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
