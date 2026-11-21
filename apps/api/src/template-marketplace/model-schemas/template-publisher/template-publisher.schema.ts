import { sql } from "drizzle-orm";
import { boolean, check, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { Organizations } from "@src/organization/model-schemas/organization/organization.schema";

export const MAX_PUBLISHER_HANDLE_LENGTH = 64;
export const MAX_PUBLISHER_BIO_LENGTH = 300;

export const TemplatePublishers = pgTable(
  "template_publishers",
  {
    organizationId: uuid("organization_id")
      .primaryKey()
      .notNull()
      .references(() => Organizations.id, { onDelete: "cascade" }),
    handle: varchar("handle", { length: MAX_PUBLISHER_HANDLE_LENGTH }).notNull().unique(),
    bio: varchar("bio", { length: MAX_PUBLISHER_BIO_LENGTH }),
    links: jsonb("links")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    isVerified: boolean("verified").default(false).notNull(),
    publishingSuspendedAt: timestamp("publishing_suspended_at", { withTimezone: true }),
    publishingSuspendedReason: text("publishing_suspended_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date())
  },
  table => ({
    /** The handle is a URL path segment, and the admin app writes this table too. */
    handleFormat: check("template_publishers_handle_format", sql`${table.handle} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`)
  })
);
