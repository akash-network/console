import { faker } from "@faker-js/faker";
import { container } from "tsyringe";

import type { ApiPgDatabase, ApiPgTables } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { DEFAULT_PROJECT_NAME, DEFAULT_PROJECT_SLUG } from "@src/organization/model-schemas/project/project.schema";
import type { UserInput } from "@src/user/repositories";
import { createOrganizationSlug } from "../organization.seeder";
import { seedUser } from "./user-with-wallet.seeder";

type OrganizationInsert = ApiPgTables["Organizations"]["$inferInsert"];
type OrganizationMemberInsert = ApiPgTables["OrganizationMembers"]["$inferInsert"];
type ProjectInsert = ApiPgTables["Projects"]["$inferInsert"];
type ProjectMemberInsert = ApiPgTables["ProjectMembers"]["$inferInsert"];
type OrganizationActivityInsert = ApiPgTables["OrganizationActivities"]["$inferInsert"];

export async function seedOrganization(overrides: Partial<OrganizationInsert> = {}) {
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
  const [organization] = await db
    .insert(resolveTable("Organizations"))
    .values({
      name: faker.company.name().slice(0, 64),
      slug: createOrganizationSlug(),
      type: "team",
      ...overrides
    })
    .returning();

  return organization;
}

export async function seedOrganizationMember(overrides: Partial<OrganizationMemberInsert> & Pick<OrganizationMemberInsert, "organizationId" | "userId">) {
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
  const [member] = await db
    .insert(resolveTable("OrganizationMembers"))
    .values({ role: "member", ...overrides })
    .returning();

  return member;
}

export async function seedProject(overrides: Partial<ProjectInsert> & Pick<ProjectInsert, "organizationId">) {
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
  const [project] = await db
    .insert(resolveTable("Projects"))
    .values({
      name: faker.commerce.productName().slice(0, 64),
      slug: `project-${faker.string.alphanumeric(8).toLowerCase()}`,
      ...overrides
    })
    .returning();

  return project;
}

export async function seedProjectMember(overrides: Partial<ProjectMemberInsert> & Pick<ProjectMemberInsert, "organizationId" | "projectId" | "userId">) {
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
  const [member] = await db
    .insert(resolveTable("ProjectMembers"))
    .values({ role: "member", ...overrides })
    .returning();

  return member;
}

export async function seedOrganizationActivity(overrides: Partial<OrganizationActivityInsert> & Pick<OrganizationActivityInsert, "organizationId">) {
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
  const [activity] = await db
    .insert(resolveTable("OrganizationActivities"))
    .values({ type: "organization_created", payload: { organizationName: faker.company.name() }, ...overrides })
    .returning();

  return activity;
}

export async function seedOrganizationWithOwner({ user: userOverrides, ...overrides }: Partial<OrganizationInsert> & { user?: UserInput } = {}) {
  const user = await seedUser(userOverrides);
  const organization = await seedOrganization({ createdByUserId: user.id, ...overrides });
  const membership = await seedOrganizationMember({ organizationId: organization.id, userId: user.id, role: "owner" });
  const project = await seedProject({
    organizationId: organization.id,
    name: DEFAULT_PROJECT_NAME,
    slug: DEFAULT_PROJECT_SLUG,
    isDefault: true,
    createdByUserId: user.id
  });

  return { user, organization, membership, project };
}
