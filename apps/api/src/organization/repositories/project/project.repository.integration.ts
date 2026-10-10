import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { DEFAULT_PROJECT_NAME, DEFAULT_PROJECT_SLUG } from "@src/organization/model-schemas/project/project.schema";
import { ProjectRepository } from "./project.repository";

import { seedOrganization, seedOrganizationMember, seedProject, seedProjectMember } from "@test/seeders/db/organization.seeder";
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

  describe("findActive", () => {
    it("finds a live project of the organization", async () => {
      const { repository, organization } = await setup();
      const project = await seedProject({ organizationId: organization.id });

      expect(await repository.findActive(organization.id, project.id)).toEqual(project);
    });

    it("finds neither a deleted project nor one of another organization", async () => {
      const { repository, organization, user } = await setup();
      const deleted = await seedProject({ organizationId: organization.id, deletedAt: new Date() });
      const foreign = await seedProject({ organizationId: (await seedOrganization({ createdByUserId: user.id })).id });

      expect(await repository.findActive(organization.id, deleted.id)).toBeUndefined();
      expect(await repository.findActive(organization.id, foreign.id)).toBeUndefined();
    });
  });

  describe("findActiveIdsAmong", () => {
    it("keeps only the ids of live projects of the organization", async () => {
      const { repository, organization, user } = await setup();
      const live = await seedProject({ organizationId: organization.id });
      const deleted = await seedProject({ organizationId: organization.id, deletedAt: new Date() });
      const foreign = await seedProject({ organizationId: (await seedOrganization({ createdByUserId: user.id })).id });

      expect(await repository.findActiveIdsAmong(organization.id, [live.id, deleted.id, foreign.id, faker.string.uuid()])).toEqual([live.id]);
    });
  });

  describe("findActiveIdsGrantedTo", () => {
    it("lists the live projects of the organization granted to the user and nothing else", async () => {
      const { repository, organization, user } = await setup();
      const colleague = await seedUser({ userId: faker.string.uuid() });
      await seedOrganizationMember({ organizationId: organization.id, userId: user.id });
      await seedOrganizationMember({ organizationId: organization.id, userId: colleague.id });
      const granted = await seedProject({ organizationId: organization.id });
      const deleted = await seedProject({ organizationId: organization.id, deletedAt: new Date() });
      const colleagueOnly = await seedProject({ organizationId: organization.id });
      await seedProject({ organizationId: organization.id });
      await seedProjectMember({ organizationId: organization.id, projectId: granted.id, userId: user.id });
      await seedProjectMember({ organizationId: organization.id, projectId: deleted.id, userId: user.id });
      await seedProjectMember({ organizationId: organization.id, projectId: colleagueOnly.id, userId: colleague.id });
      const other = await seedOrganization({ createdByUserId: user.id });
      await seedOrganizationMember({ organizationId: other.id, userId: user.id });
      const otherProject = await seedProject({ organizationId: other.id });
      await seedProjectMember({ organizationId: other.id, projectId: otherProject.id, userId: user.id });

      expect(await repository.findActiveIdsGrantedTo(organization.id, user.id)).toEqual([granted.id]);
    });
  });

  async function setup() {
    const repository = container.resolve(ProjectRepository);
    const user = await seedUser({ userId: faker.string.uuid() });
    const organization = await seedOrganization({ createdByUserId: user.id });

    return { repository, user, organization };
  }
});
