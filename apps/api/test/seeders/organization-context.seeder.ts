import { faker } from "@faker-js/faker";

import type { OrganizationContext } from "@src/organization/types/organization-context";

export function createOrganizationContext({
  organizationId = faker.string.uuid(),
  organizationType = "team",
  role = "owner",
  projectScope = { kind: "all" },
  mode = "organization"
}: Partial<OrganizationContext> = {}): OrganizationContext {
  return { organizationId, organizationType, role, projectScope, mode };
}
