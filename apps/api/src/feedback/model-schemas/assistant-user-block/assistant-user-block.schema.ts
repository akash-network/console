import { sql } from "drizzle-orm";
import { index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { Users } from "@src/user/model-schemas";

export const assistantUserBlockSourceEnum = pgEnum("assistant_user_block_source", ["automatic", "admin"]);

export type AssistantUserBlockSource = (typeof assistantUserBlockSourceEnum.enumValues)[number];

/** Admin tools lift a block by setting lifted_at and make it permanent by clearing blocked_until, and the API reads both on every message. */
export const AssistantUserBlocks = pgTable(
  "assistant_user_blocks",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    userId: uuid("user_id")
      .references(() => Users.id, { onDelete: "cascade" })
      .notNull(),
    source: assistantUserBlockSourceEnum("source").notNull(),
    blockedUntil: timestamp("blocked_until", { withTimezone: true }),
    flaggedTurnCount: integer("flagged_turn_count"),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    liftedAt: timestamp("lifted_at", { withTimezone: true }),
    liftedBy: text("lifted_by")
  },
  table => ({
    userIdCreatedAtIdx: index("assistant_user_blocks_user_id_created_at_idx").on(table.userId, table.createdAt),
    /** Covers lifted rows on purpose, so an admin's lift holds for the rest of that UTC day. */
    automaticUserIdBlockedUntilUnique: uniqueIndex("assistant_user_blocks_automatic_user_id_blocked_until_unique")
      .on(table.userId, table.blockedUntil)
      .where(sql`${table.source} = 'automatic'`)
  })
);
