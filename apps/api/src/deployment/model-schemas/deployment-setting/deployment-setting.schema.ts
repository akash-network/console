import { sql } from "drizzle-orm";
import { boolean, index, integer, pgTable, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";

import { Users } from "@src/user/model-schemas";

export const DeploymentSettings = pgTable(
  "deployment_settings",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    userId: uuid("user_id")
      .references(() => Users.id, { onDelete: "cascade" })
      .notNull(),
    dseq: varchar("dseq").notNull(),
    autoTopUpEnabled: boolean("auto_top_up_enabled").notNull().default(false),
    closed: boolean("closed").notNull().default(false),
    lastFundedAt: timestamp("last_funded_at"),
    runtimeLimitHours: integer("runtime_limit_hours"),
    runtimeEndsAt: timestamp("runtime_ends_at", { withTimezone: true }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow()
  },
  table => ({
    dseqUserIdIdx: unique("dseq_user_id_idx").on(table.dseq, table.userId),
    idAutoTopUpEnabledClosedIdx: index("id_auto_top_up_enabled_closed_idx").on(table.id, table.autoTopUpEnabled, table.closed)
  })
);
