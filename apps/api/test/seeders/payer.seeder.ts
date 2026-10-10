import { faker } from "@faker-js/faker";

import type { PayingPayer } from "@src/billing/services/payer/payer";
import type { OrganizationOutput } from "@src/organization/repositories/organization/organization.repository";
import type { UserOutput } from "@src/user/repositories";
import { createOrganization } from "./organization.seeder";
import { createUser } from "./user.seeder";

export function createUserPayer(overrides: { user?: Partial<UserOutput>; organizationId?: string } = {}): PayingPayer {
  const user = createUser({ stripeCustomerId: `cus_${faker.string.alphanumeric(14)}`, ...overrides.user });

  return { user, organizationId: overrides.organizationId ?? faker.string.uuid(), stripeCustomerId: user.stripeCustomerId! };
}

export function createTeamPayer(overrides: { user?: Partial<UserOutput>; team?: Partial<OrganizationOutput> } = {}): PayingPayer {
  const user = createUser({ stripeCustomerId: null, ...overrides.user });
  const team = createOrganization({ type: "team", stripeCustomerId: `cus_${faker.string.alphanumeric(14)}`, ...overrides.team });

  return { user, organizationId: team.id, team, stripeCustomerId: team.stripeCustomerId! };
}
