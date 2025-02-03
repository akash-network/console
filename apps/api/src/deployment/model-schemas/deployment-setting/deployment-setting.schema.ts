import { boolean, index, pgTable, serial, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";

import { Users } from "@src/user/model-schemas";

export const DeploymentSettings = pgTable(
  "deployment_settings",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .references(() => Users.id, { onDelete: "cascade" })
      .notNull(),
    dseq: varchar("dseq").notNull(),
    autoTopUpEnabled: boolean("auto_top_up_enabled").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow()
  },
  table => ({
    dseqUserIdIdx: unique("dseq_user_id_idx").on(table.dseq, table.userId),
    autoTopUpEnabledIdIdx: index("auto_top_up_enabled_id_idx").on(table.autoTopUpEnabled, table.id)
  })
);
