import { faker } from "@faker-js/faker";

import type { OrganizationOutput } from "@src/organization/repositories/organization/organization.repository";
import type { OrganizationActivityWithActor } from "@src/organization/repositories/organization-activity/organization-activity.repository";
import type { AdoptedRowCounts } from "@src/organization/repositories/organization-adoption/organization-adoption.repository";
import type { OrganizationMemberOutput } from "@src/organization/repositories/organization-member/organization-member.repository";
import type { ProjectOutput } from "@src/organization/repositories/project/project.repository";
import type { ProjectMemberWithUser } from "@src/organization/repositories/project-member/project-member.repository";

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

export function createProjectMemberWithUser({
  id = faker.string.uuid(),
  organizationId = faker.string.uuid(),
  projectId = faker.string.uuid(),
  userId = faker.string.uuid(),
  role = "member",
  username = faker.internet.userName(),
  email = faker.internet.email(),
  createdAt = faker.date.recent(),
  updatedAt = faker.date.recent()
}: Partial<ProjectMemberWithUser> = {}): ProjectMemberWithUser {
  return { id, organizationId, projectId, userId, role, username, email, createdAt, updatedAt };
}

export function createOrganizationActivity({
  id = faker.string.uuid(),
  organizationId = faker.string.uuid(),
  projectId = faker.string.uuid(),
  actorUserId = faker.string.uuid(),
  type = "project_created",
  payload = { projectName: faker.word.noun() },
  createdAt = faker.date.recent(),
  actor = actorUserId ? { id: actorUserId, username: faker.internet.userName() } : null
}: Partial<OrganizationActivityWithActor> = {}): OrganizationActivityWithActor {
  return { id, organizationId, projectId, actorUserId, type, payload, createdAt, actor };
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
