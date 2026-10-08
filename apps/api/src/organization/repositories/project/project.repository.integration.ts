import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { DEFAULT_PROJECT_NAME, DEFAULT_PROJECT_SLUG } from "@src/organization/model-schemas/project/project.schema";
import { ProjectRepository } from "./project.repository";

import { seedOrganization, seedProject } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";

describe(ProjectRepository.name, () => {
  describe("createDefaultUnlessExists", () => {
    it("creates the default project once per organization", async () => {
      const { repository, organization, user } = await setup();

      const created = await repository.createDefaultUnlessExists({ organizationId: organization.id, createdByUserId: user.id });
      const repeated = await repository.createDefaultUnlessExists({ organizationId: organization.id, createdByUserId: user.id });

      expect(created).toMatchObject({
        organizationId: organization.id,
        name: DEFAULT_PROJECT_NAME,
        slug: DEFAULT_PROJECT_SLUG,
        isDefault: true,
        createdByUserId: user.id
      });
      expect(repeated).toBeUndefined();
      expect(await repository.count({ organizationId: organization.id })).toBe(1);
    });

    it("gives every organization its own default project", async () => {
      const { repository, organization, user } = await setup();
      const other = await seedOrganization({ createdByUserId: user.id });

      const created = await repository.createDefaultUnlessExists({ organizationId: organization.id, createdByUserId: user.id });
      const otherCreated = await repository.createDefaultUnlessExists({ organizationId: other.id, createdByUserId: user.id });

      expect(created?.organizationId).toBe(organization.id);
      expect(otherCreated?.organizationId).toBe(other.id);
    });
  });

  describe("findDefaultByOrganizationId", () => {
    it("finds the default project and not the other ones", async () => {
      const { repository, organization, user } = await setup();
      await seedProject({ organizationId: organization.id, createdByUserId: user.id });
      const created = await repository.createDefaultUnlessExists({ organizationId: organization.id, createdByUserId: user.id });

      expect(await repository.findDefaultByOrganizationId(organization.id)).toEqual(created);
    });

    it("finds nothing for an organization without a default project", async () => {
      const { repository, organization, user } = await setup();
      await seedProject({ organizationId: organization.id, createdByUserId: user.id });

      expect(await repository.findDefaultByOrganizationId(organization.id)).toBeUndefined();
    });
  });

  async function setup() {
    const repository = container.resolve(ProjectRepository);
    const user = await seedUser({ userId: faker.string.uuid() });
    const organization = await seedOrganization({ createdByUserId: user.id });

    return { repository, user, organization };
  }
});
