import { sql } from "drizzle-orm";
import { check, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { Users } from "@src/user/model-schemas";

export const blockedEmailDomainStatusEnum = pgEnum("blocked_email_domain_status", ["blocked", "allowed"]);

export const blockedEmailDomainSourceEnum = pgEnum("blocked_email_domain_source", ["auto", "manual"]);

export const MAX_EMAIL_DOMAIN_LENGTH = 253;

export const BlockedEmailDomains = pgTable(
  "blocked_email_domains",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    domain: varchar("domain", { length: MAX_EMAIL_DOMAIN_LENGTH }).notNull(),
    status: blockedEmailDomainStatusEnum("status").notNull().default("blocked"),
    /** Defaults to manual so a row written straight into the table by the admin console is labelled correctly without it having to say so. */
    source: blockedEmailDomainSourceEnum("source").notNull().default("manual"),
    reason: varchar("reason", { length: 255 }),
    /** Set null rather than cascade: cascading would silently un-block a domain when the abusive user row is deleted. */
    triggeredByUserId: uuid("triggered_by_user_id").references(() => Users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    domainUnique: uniqueIndex("blocked_email_domains_domain_unique").on(table.domain),
    /** The admin console writes this table directly, and a row stored unnormalized would never match a lookup — a blocklist that silently stops blocking. */
    domainNormalized: check(
      "blocked_email_domains_domain_normalized",
      sql`${table.domain} = lower(${table.domain}) AND ${table.domain} NOT LIKE '%@%' AND ${table.domain} LIKE '%.%' AND btrim(${table.domain}) = ${table.domain}`
    )
  })
);
