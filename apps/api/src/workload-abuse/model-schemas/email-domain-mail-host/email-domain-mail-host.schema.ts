import { sql } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { MAX_EMAIL_DOMAIN_LENGTH } from "@src/workload-abuse/lib/email-domain/email-domain";

export const EmailDomainMailHosts = pgTable(
  "email_domain_mail_hosts",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    domain: varchar("domain", { length: MAX_EMAIL_DOMAIN_LENGTH }).notNull(),
    mxHosts: text("mx_hosts").array().notNull(),
    /** Only addresses of mail hosts named under the domain itself, so a provider shared by unrelated owners such as Google Workspace never links two domains. */
    selfHostedMxIps: text("self_hosted_mx_ips").array().notNull(),
    hasWebsite: boolean("has_website").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    domainUnique: uniqueIndex("email_domain_mail_hosts_domain_unique").on(table.domain),
    selfHostedMxIpsIdx: index("email_domain_mail_hosts_self_hosted_mx_ips_idx").using("gin", table.selfHostedMxIps)
  })
);
