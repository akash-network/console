import { sql } from "drizzle-orm";
import { index, jsonb, pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { Users } from "@src/user/model-schemas";

export const activityTypeEnum = pgEnum("activity_type", ["deployment_close"]);
export const activityStatusEnum = pgEnum("activity_status", ["pending", "succeeded", "failed"]);

export type ActivityType = (typeof activityTypeEnum.enumValues)[number];
export type ActivityStatus = (typeof activityStatusEnum.enumValues)[number];

export type ActivityMeta = {
  dseq?: string;
  txHash?: string;
  error?: { code: string; message: string };
};

export type NewActivity = {
  userId: string;
  type: ActivityType;
  status: ActivityStatus;
  meta: ActivityMeta;
};

export const Activities = pgTable(
  "activities",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    userId: uuid("user_id")
      .references(() => Users.id, { onDelete: "cascade" })
      .notNull(),
    type: activityTypeEnum("type").notNull(),
    status: activityStatusEnum("status").notNull(),
    meta: jsonb("meta").$type<ActivityMeta>().notNull().default({}),
    seenAt: timestamp("seen_at", { withTimezone: true }),
    /** Millisecond precision so the page cursor, which round-trips through a JS Date, names a row exactly. */
    createdAt: timestamp("created_at", { withTimezone: true, precision: 3 }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    userIdCreatedAtIdIdx: index("activities_user_id_created_at_id_idx").on(table.userId, table.createdAt, table.id),
    userIdUnseenIdx: index("activities_user_id_unseen_idx")
      .on(table.userId)
      .where(sql`${table.seenAt} IS NULL`)
  })
);
