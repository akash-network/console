import { sql } from "drizzle-orm";
import { jsonb, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { Organizations } from "@src/organization/model-schemas/organization/organization.schema";
import { organizationRoleEnum } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import type { ProjectRole } from "@src/organization/model-schemas/project-member/project-member.schema";
import { Users } from "@src/user/model-schemas/user/user.schema";

export const organizationInvitationStatusEnum = pgEnum("organization_invitation_status", ["pending", "accepted", "revoked"]);

export type OrganizationInvitationStatus = (typeof organizationInvitationStatusEnum.enumValues)[number];

export type ProjectGrant = { projectId: string; role: ProjectRole };

export const OrganizationInvitations = pgTable(
  "organization_invitations",
  {
    id: uuid("id")
      .primaryKey()
      .notNull()
      .default(sql`uuid_generate_v4()`),
    organizationId: uuid("organization_id")
      .references(() => Organizations.id, { onDelete: "cascade" })
      .notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    role: organizationRoleEnum("role").notNull(),
    projectGrants: jsonb("project_grants").$type<ProjectGrant[]>().notNull().default([]),
    /** sha256 hex of the invitation token; the token itself is only ever sent to the invitee. */
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    status: organizationInvitationStatusEnum("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    invitedByUserId: uuid("invited_by_user_id").references(() => Users.id, { onDelete: "set null" }),
    acceptedByUserId: uuid("accepted_by_user_id").references(() => Users.id, { onDelete: "set null" }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  table => ({
    organizationIdEmailPendingUnique: uniqueIndex("organization_invitations_organization_id_email_pending_unique")
      .on(table.organizationId, table.email)
      .where(sql`${table.status} = 'pending'`)
  })
);
