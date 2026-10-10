import { faker } from "@faker-js/faker";

import type { OrganizationOutput } from "@src/organization/repositories/organization/organization.repository";
import type { AdoptedRowCounts } from "@src/organization/repositories/organization-adoption/organization-adoption.repository";
import type {
  OrganizationInvitationOutput,
  OrganizationInvitationWithInviter
} from "@src/organization/repositories/organization-invitation/organization-invitation.repository";
import type { OrganizationMemberOutput, OrganizationMemberWithUser } from "@src/organization/repositories/organization-member/organization-member.repository";
import type { ProjectOutput } from "@src/organization/repositories/project/project.repository";

export function createOrganizationSlug() {
  return `org-${faker.string.alphanumeric(12).toLowerCase()}`;
}

export function createOrganization({
  id = faker.string.uuid(),
  name = faker.company.name().slice(0, 64),
  slug = createOrganizationSlug(),
  type = "team",
  stripeCustomerId = null,
  createdByUserId = faker.string.uuid(),
  deletedAt = null,
  createdAt = faker.date.recent(),
  updatedAt = faker.date.recent()
}: Partial<OrganizationOutput> = {}): OrganizationOutput {
  return { id, name, slug, type, stripeCustomerId, createdByUserId, deletedAt, createdAt, updatedAt };
}

export function createOrganizationMember({
  id = faker.string.uuid(),
  organizationId = faker.string.uuid(),
  userId = faker.string.uuid(),
  role = "member",
  createdAt = faker.date.recent(),
  updatedAt = faker.date.recent()
}: Partial<OrganizationMemberOutput> = {}): OrganizationMemberOutput {
  return { id, organizationId, userId, role, createdAt, updatedAt };
}

export function createOrganizationMemberWithUser({
  id = faker.string.uuid(),
  userId = faker.string.uuid(),
  role = "member",
  createdAt = faker.date.recent(),
  username = faker.internet.userName(),
  email = faker.internet.email()
}: Partial<OrganizationMemberWithUser> = {}): OrganizationMemberWithUser {
  return { id, userId, role, createdAt, username, email };
}

export function createProject({
  id = faker.string.uuid(),
  organizationId = faker.string.uuid(),
  name = faker.commerce.productName().slice(0, 64),
  slug = `project-${faker.string.alphanumeric(8).toLowerCase()}`,
  description = null,
  isDefault = false,
  createdByUserId = faker.string.uuid(),
  deletedAt = null,
  createdAt = faker.date.recent(),
  updatedAt = faker.date.recent()
}: Partial<ProjectOutput> = {}): ProjectOutput {
  return { id, organizationId, name, slug, description, isDefault, createdByUserId, deletedAt, createdAt, updatedAt };
}

export function createAdoptedRowCounts(overrides: Partial<AdoptedRowCounts> = {}): AdoptedRowCounts {
  return {
    userWallets: 0,
    walletSettings: 0,
    paymentMethods: 0,
    stripeTransactions: 0,
    deploymentSettings: 0,
    apiKeys: 0,
    templates: 0,
    ...overrides
  };
}

export function createOrganizationInvitation({
  id = faker.string.uuid(),
  organizationId = faker.string.uuid(),
  email = faker.internet.email().toLowerCase(),
  role = "member",
  projectGrants = [],
  tokenHash = faker.string.hexadecimal({ length: 64, casing: "lower", prefix: "" }),
  status = "pending",
  expiresAt = faker.date.soon({ days: 7 }),
  invitedByUserId = faker.string.uuid(),
  acceptedByUserId = null,
  acceptedAt = null,
  revokedAt = null,
  createdAt = faker.date.recent(),
  updatedAt = faker.date.recent()
}: Partial<OrganizationInvitationOutput> = {}): OrganizationInvitationOutput {
  return {
    id,
    organizationId,
    email,
    role,
    projectGrants,
    tokenHash,
    status,
    expiresAt,
    invitedByUserId,
    acceptedByUserId,
    acceptedAt,
    revokedAt,
    createdAt,
    updatedAt
  };
}

export function createOrganizationInvitationWithInviter({
  id = faker.string.uuid(),
  organizationId = faker.string.uuid(),
  email = faker.internet.email().toLowerCase(),
  role = "member",
  projectGrants = [],
  createdAt = faker.date.recent(),
  expiresAt = faker.date.soon({ days: 7 }),
  invitedBy = { id: faker.string.uuid(), username: faker.internet.userName() }
}: Partial<OrganizationInvitationWithInviter> = {}): OrganizationInvitationWithInviter {
  return { id, organizationId, email, role, projectGrants, createdAt, expiresAt, invitedBy };
}
