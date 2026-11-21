import { sql } from "drizzle-orm";
import { index, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

import { Organizations } from "@src/organization/model-schemas/organization/organization.schema";
import { Templates } from "@src/user/model-schemas/template/template.schema";
import { Users } from "@src/user/model-schemas/user/user.schema";

export const MAX_TERMS_VERSION_LENGTH = 16;

export const TemplateTermsAcceptances = pgTable(
  "template_terms_acceptances",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    templateId: uuid("template_id")
      .references(() => Templates.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id").references(() => Users.id, { onDelete: "set null" }),
    organizationId: uuid("organization_id")
      .references(() => Organizations.id, { onDelete: "cascade" })
      .notNull(),
    termsVersion: varchar("terms_version", { length: MAX_TERMS_VERSION_LENGTH }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    templateIdIdx: index("template_terms_acceptances_template_id_idx").on(table.templateId),
    userIdAcceptedAtIdx: index("template_terms_acceptances_user_id_accepted_at_idx").on(table.userId, table.acceptedAt),
    organizationIdAcceptedAtIdx: index("template_terms_acceptances_organization_id_accepted_at_idx").on(table.organizationId, table.acceptedAt)
  })
);
