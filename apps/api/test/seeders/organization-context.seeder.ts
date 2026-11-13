import { faker } from "@faker-js/faker";

import type { OrganizationContext, ProjectScope } from "@src/organization/types/organization-context";

export function createOrganizationContext({
  organizationId = faker.string.uuid(),
  organizationType = "team",
  role = "owner",
  projectScope = { kind: "all" }
}: Partial<OrganizationContext> = {}): OrganizationContext {
  return { organizationId, organizationType, role, projectScope };
}

export function createProjectsScope(
  projectIds: readonly string[],
  levels: { writableProjectIds?: readonly string[]; adminProjectIds?: readonly string[] } = {}
): ProjectScope {
  return { kind: "projects", projectIds, writableProjectIds: levels.writableProjectIds ?? projectIds, adminProjectIds: levels.adminProjectIds ?? [] };
}
