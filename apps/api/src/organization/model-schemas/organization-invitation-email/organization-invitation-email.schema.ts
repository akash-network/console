import { sql } from "drizzle-orm";
import { index, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { Organizations } from "@src/organization/model-schemas/organization/organization.schema";
import { OrganizationInvitations } from "@src/organization/model-schemas/organization-invitation/organization-invitation.schema";
import { Users } from "@src/user/model-schemas/user/user.schema";

/** One row per invitation email requested, kept so sends can be counted over time. */
export const OrganizationInvitationEmails = pgTable(
  "organization_invitation_emails",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    organizationId: uuid("organization_id")
      .references(() => Organizations.id, { onDelete: "cascade" })
      .notNull(),
    invitationId: uuid("invitation_id")
      .references(() => OrganizationInvitations.id, { onDelete: "cascade" })
      .notNull(),
    sentByUserId: uuid("sent_by_user_id").references(() => Users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    organizationIdCreatedAtIdx: index("organization_invitation_emails_organization_id_created_at_idx").on(table.organizationId, table.createdAt),
    sentByUserIdCreatedAtIdx: index("organization_invitation_emails_sent_by_user_id_created_at_idx").on(table.sentByUserId, table.createdAt),
    invitationIdIdx: index("organization_invitation_emails_invitation_id_idx").on(table.invitationId)
  })
);
