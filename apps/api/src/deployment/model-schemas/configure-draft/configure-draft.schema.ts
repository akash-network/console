import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { Users } from "@src/user/model-schemas/user/user.schema";

/** What the configure page needs to pick a session back up; secret values never travel with it, only the references the SDL carries. */
export interface ConfigureDraftContent {
  sdl: string;
  startingSdl?: string;
  name?: string;
  runtimeLimitHours?: number;
  inheritSecretsFrom?: string;
  placementRegions?: Record<string, string[]>;
}

export const ConfigureDrafts = pgTable(
  "configure_drafts",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    userId: uuid("user_id")
      .references(() => Users.id, { onDelete: "cascade" })
      .notNull(),
    draftId: varchar("draft_id", { length: 64 }).notNull(),
    content: jsonb("content").$type<ConfigureDraftContent>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    userIdDraftIdIdx: uniqueIndex("configure_drafts_user_id_draft_id_idx").on(table.userId, table.draftId),
    userIdUpdatedAtIdx: index("configure_drafts_user_id_updated_at_idx").on(table.userId, table.updatedAt)
  })
);
