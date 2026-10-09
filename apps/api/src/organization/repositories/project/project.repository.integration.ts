import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { AbilityService } from "@src/auth/services/ability/ability.service";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { DEFAULT_PROJECT_NAME, DEFAULT_PROJECT_SLUG } from "@src/organization/model-schemas/project/project.schema";
import type { OrganizationContext } from "@src/organization/types/organization-context";
import type { UserOutput } from "@src/user/repositories";
import { ProjectRepository } from "./project.repository";

import { seedOrganization, seedOrganizationMember, seedOrganizationWithOwner, seedProject, seedProjectMember } from "@test/seeders/db/organization.seeder";
import { seedUser } from "@test/seeders/db/user-with-wallet.seeder";
import { createOrganizationContext } from "@test/seeders/organization-context.seeder";

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

  describe("findActiveWithCreator", () => {
    it("lists the live projects of the active organization, default first then oldest first, with who created them", async () => {
      const { repository, organization, user, runIn } = await setup();
      const { project: foreign } = await seedOrganizationWithOwner();
      const defaultProject = await seedProject({
        organizationId: organization.id,
        isDefault: true,
        createdByUserId: user.id,
        createdAt: new Date("2026-03-01")
      });
      const older = await seedProject({ organizationId: organization.id, createdByUserId: null, createdAt: new Date("2026-01-01") });
      const newer = await seedProject({ organizationId: organization.id, createdByUserId: user.id, createdAt: new Date("2026-02-01") });
      await seedProject({ organizationId: organization.id, deletedAt: new Date() });

      const projects = await runIn({ user, organizationId: organization.id, role: "owner" }, ability =>
        repository.accessibleBy(ability, "read").findActiveWithCreator()
      );

      expect(projects.map(({ id }) => id)).toEqual([defaultProject.id, older.id, newer.id]);
      expect(projects.map(({ id }) => id)).not.toContain(foreign.id);
      expect(projects.map(({ createdBy }) => createdBy)).toEqual([{ id: user.id, username: user.username }, null, { id: user.id, username: user.username }]);
    });

    it("lists only the projects a member was granted", async () => {
      const { repository, organization, user, runIn } = await setup();
      const granted = await seedProject({ organizationId: organization.id });
      await seedProject({ organizationId: organization.id });

      const projects = await runIn(
        { user, organizationId: organization.id, role: "member", projectScope: { kind: "projects", projectIds: [granted.id] } },
        ability => repository.accessibleBy(ability, "read").findActiveWithCreator()
      );

      expect(projects.map(({ id }) => id)).toEqual([granted.id]);
    });

    it("finds the one project with the id it is given", async () => {
      const { repository, organization, user, runIn } = await setup();
      const wanted = await seedProject({ organizationId: organization.id });
      await seedProject({ organizationId: organization.id });

      const projects = await runIn({ user, organizationId: organization.id, role: "owner" }, ability =>
        repository.accessibleBy(ability, "read").findActiveWithCreator({ id: wanted.id })
      );

      expect(projects).toEqual([{ ...wanted, createdBy: null }]);
    });
  });

  async function setup() {
    const repository = container.resolve(ProjectRepository);
    const user = await seedUser({ userId: faker.string.uuid() });
    const organization = await seedOrganization({ createdByUserId: user.id });
    const executionContextService = container.resolve(ExecutionContextService);
    const abilityService = container.resolve(AbilityService);

    const runIn = <R>(
      { user: caller, ...context }: Partial<OrganizationContext> & { user: UserOutput },
      run: (ability: ReturnType<AbilityService["getAbilityFor"]>) => Promise<R>
    ) =>
      executionContextService.runWithContext(async () => {
        executionContextService.set("ORGANIZATION_CONTEXT", createOrganizationContext(context));
        return await run(abilityService.getAbilityFor("REGULAR_USER", caller));
      });

    return { repository, user, organization, runIn };
  }
});
